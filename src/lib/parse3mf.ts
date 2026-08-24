import JSZip from "jszip";
import { parseSliceInfo } from "./print/sliceInfo";
import { parseGcodeSummary } from "./print/gcodeSummary";
import { DEFAULT_SHELL_PARAMS, type ShellParams } from "./print/shell";
import type { MeshAreas, SlicerReport } from "./print/types";
import {
  IDENTITY,
  applyTransform,
  multiplyTransforms,
  parseTransform,
  type Mat4x3,
} from "./print/transform";

export interface SlicingParams {
  outerWallSpeed: number; // mm/s
  innerWallSpeed: number;
  infillSpeed: number;
  solidInfillSpeed: number;
  initialLayerSpeed: number;
  layerHeight: number; // mm
  lineWidth: number; // mm
  infillDensity: number; // 0–1
}

export interface Parse3MFResult {
  fileName: string;

  /** Datos exactos del laminador, si el archivo fue exportado después de laminar. */
  slicerReport?: SlicerReport;

  /** Geometría. Ausente en un .3mf laminado, que no lleva malla. */
  totalVolumeMm3: number;
  areas: MeshAreas;
  dimensions: { x: number; y: number; z: number };
  vertexCount: number;
  triangleCount: number;

  /** Perfil del laminador. */
  filamentDensity?: number;
  filamentType?: string;
  filamentFlowRatio?: number;
  filamentDiameter?: number;
  filaments?: Array<{ type?: string; density?: number }>;
  printerModel?: string;
  shellParams?: ShellParams;
  slicingParams?: SlicingParams;
  supportEnabled?: boolean;
  primeTowerEnabled?: boolean;
}

/** Umbral de |cos| con el eje Z para considerar una cara horizontal. */
const HORIZONTAL_COS = 0.6;

interface MeshMeasure {
  signedVolume: number;
  areas: MeshAreas;
}

/**
 * Volumen (tetraedros con signo) y área clasificada por orientación, en una
 * sola pasada. El área separada por normal es lo que alimenta el modelo de
 * cáscara: pared vertical, techo y piso tienen espesores distintos.
 */
function measureMesh(verts: Float64Array, tris: Uint32Array): MeshMeasure {
  let vol = 0;
  let lateral = 0;
  let up = 0;
  let down = 0;

  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    const ax = verts[a], ay = verts[a + 1], az = verts[a + 2];
    const bx = verts[b], by = verts[b + 1], bz = verts[b + 2];
    const cx = verts[c], cy = verts[c + 1], cz = verts[c + 2];

    vol +=
      (ax * (by * cz - cy * bz) +
       bx * (cy * az - ay * cz) +
       cx * (ay * bz - by * az)) / 6;

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;

    const area = len / 2;
    const cos = nz / len;
    if (cos > HORIZONTAL_COS) up += area;
    else if (cos < -HORIZONTAL_COS) down += area;
    else lateral += area;
  }

  // Si el bobinado está invertido el volumen sale negativo y las normales
  // apuntan hacia adentro: techo y piso quedan intercambiados.
  const inverted = vol < 0;
  return {
    signedVolume: vol,
    areas: {
      lateralMm2: lateral,
      topMm2: inverted ? down : up,
      bottomMm2: inverted ? up : down,
    },
  };
}

function updateBBox(
  verts: Float64Array,
  bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
) {
  for (let i = 0; i < verts.length; i += 3) {
    const x = verts[i], y = verts[i + 1], z = verts[i + 2];
    if (x < bbox.minX) bbox.minX = x;
    if (x > bbox.maxX) bbox.maxX = x;
    if (y < bbox.minY) bbox.minY = y;
    if (y > bbox.maxY) bbox.maxY = y;
    if (z < bbox.minZ) bbox.minZ = z;
    if (z > bbox.maxZ) bbox.maxZ = z;
  }
}

interface RawMesh {
  vertices: Float64Array;
  triangles: Uint32Array;
}

function parseMeshElement(meshEl: Element): RawMesh {
  const vertEls = meshEl.getElementsByTagName("vertex");
  const verts = new Float64Array(vertEls.length * 3);
  for (let i = 0; i < vertEls.length; i++) {
    verts[i * 3]     = parseFloat(vertEls[i].getAttribute("x") ?? "0");
    verts[i * 3 + 1] = parseFloat(vertEls[i].getAttribute("y") ?? "0");
    verts[i * 3 + 2] = parseFloat(vertEls[i].getAttribute("z") ?? "0");
  }

  const triEls = meshEl.getElementsByTagName("triangle");
  const tris = new Uint32Array(triEls.length * 3);
  for (let i = 0; i < triEls.length; i++) {
    tris[i * 3]     = parseInt(triEls[i].getAttribute("v1") ?? "0", 10);
    tris[i * 3 + 1] = parseInt(triEls[i].getAttribute("v2") ?? "0", 10);
    tris[i * 3 + 2] = parseInt(triEls[i].getAttribute("v3") ?? "0", 10);
  }

  return { vertices: verts, triangles: tris };
}

interface ObjectEntry {
  type: string; // "model" | "other" | "support" …
  mesh?: RawMesh;
  components?: Array<{ path: string; objectId: string; transform: Mat4x3 }>;
}

const PRODUCTION_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06";

function parseModelDoc(xmlStr: string): Map<string, ObjectEntry> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  const map = new Map<string, ObjectEntry>();

  const objEls = doc.getElementsByTagName("object");
  for (let i = 0; i < objEls.length; i++) {
    const obj = objEls[i];
    const id = obj.getAttribute("id") ?? String(i);
    const type = obj.getAttribute("type") ?? "model";

    const meshEls = obj.getElementsByTagName("mesh");
    const mesh = meshEls.length > 0 ? parseMeshElement(meshEls[0]) : undefined;

    const compEls = obj.getElementsByTagName("component");
    const components: NonNullable<ObjectEntry["components"]> = [];
    for (let j = 0; j < compEls.length; j++) {
      const comp = compEls[j];
      const objectId = comp.getAttribute("objectid") ?? "";
      const path =
        comp.getAttributeNS(PRODUCTION_NS, "path") ?? comp.getAttribute("p:path") ?? "";
      components.push({
        path,
        objectId,
        transform: parseTransform(comp.getAttribute("transform")),
      });
    }

    map.set(id, { type, mesh, components: components.length > 0 ? components : undefined });
  }

  return map;
}

// ── Perfil del laminador ──────────────────────────────────────────────────────

type RawConfig = Record<string, string | string[]>;

/**
 * `project_settings.config` es JSON válido. Antes se leía con expresiones
 * regulares clave por clave; parsearlo entero es más robusto y da acceso a las
 * 559 claves en vez de a ocho.
 */
function parseConfig(content: string): RawConfig | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as RawConfig) : null;
  } catch {
    return null;
  }
}

function firstOf(cfg: RawConfig, key: string): string | undefined {
  const raw = cfg[key];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function listOf(cfg: RawConfig, key: string): string[] {
  const raw = cfg[key];
  if (Array.isArray(raw)) return raw;
  return typeof raw === "string" ? [raw] : [];
}

function numOf(cfg: RawConfig, key: string): number | undefined {
  const raw = firstOf(cfg, key);
  if (raw === undefined) return undefined;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function boolOf(cfg: RawConfig, key: string): boolean | undefined {
  const raw = firstOf(cfg, key);
  if (raw === undefined) return undefined;
  return raw === "1" || raw.toLowerCase() === "true";
}

/** Acepta "15%" o "0.15" y devuelve 0–1. */
function fractionOf(cfg: RawConfig, key: string): number | undefined {
  const raw = firstOf(cfg, key);
  if (!raw) return undefined;
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return undefined;
  return raw.trim().endsWith("%") ? value / 100 : value;
}

interface ProfileInfo {
  filamentDensity?: number;
  filamentType?: string;
  filamentFlowRatio?: number;
  filamentDiameter?: number;
  filaments: Array<{ type?: string; density?: number }>;
  printerModel?: string;
  shellParams?: ShellParams;
  slicingParams?: SlicingParams;
  supportEnabled?: boolean;
  primeTowerEnabled?: boolean;
}

function readProfile(content: string): ProfileInfo {
  const cfg = parseConfig(content);
  if (!cfg) return { filaments: [] };

  const types = listOf(cfg, "filament_type");
  const densities = listOf(cfg, "filament_density").map(parseFloat);
  const filaments = types.map((type, i) => ({
    type,
    density: Number.isFinite(densities[i]) && densities[i] > 0 ? densities[i] : undefined,
  }));

  const layerHeight = numOf(cfg, "layer_height");
  const outerLineWidth = numOf(cfg, "outer_wall_line_width");
  const innerLineWidth = numOf(cfg, "inner_wall_line_width") ?? outerLineWidth;
  const infillDensity = fractionOf(cfg, "sparse_infill_density");

  const shellParams: ShellParams | undefined =
    layerHeight && outerLineWidth
      ? {
          layerHeight,
          wallLoops: numOf(cfg, "wall_loops") ?? DEFAULT_SHELL_PARAMS.wallLoops,
          outerWallLineWidth: outerLineWidth,
          innerWallLineWidth: innerLineWidth ?? outerLineWidth,
          topShellLayers: numOf(cfg, "top_shell_layers") ?? DEFAULT_SHELL_PARAMS.topShellLayers,
          bottomShellLayers:
            numOf(cfg, "bottom_shell_layers") ?? DEFAULT_SHELL_PARAMS.bottomShellLayers,
          infillDensity: infillDensity ?? DEFAULT_SHELL_PARAMS.infillDensity,
        }
      : undefined;

  const outerWallSpeed = numOf(cfg, "outer_wall_speed");
  const slicingParams: SlicingParams | undefined =
    outerWallSpeed && layerHeight && outerLineWidth
      ? {
          outerWallSpeed,
          innerWallSpeed: numOf(cfg, "inner_wall_speed") ?? outerWallSpeed,
          infillSpeed: numOf(cfg, "sparse_infill_speed") ?? outerWallSpeed * 2,
          solidInfillSpeed: numOf(cfg, "internal_solid_infill_speed") ?? outerWallSpeed * 2,
          initialLayerSpeed: numOf(cfg, "initial_layer_speed") ?? outerWallSpeed * 0.5,
          layerHeight,
          lineWidth: outerLineWidth,
          infillDensity: infillDensity ?? DEFAULT_SHELL_PARAMS.infillDensity,
        }
      : undefined;

  return {
    filamentDensity: filaments[0]?.density,
    filamentType: filaments[0]?.type,
    filamentFlowRatio: numOf(cfg, "filament_flow_ratio"),
    filamentDiameter: numOf(cfg, "filament_diameter"),
    filaments,
    printerModel: firstOf(cfg, "printer_model"),
    shellParams,
    slicingParams,
    supportEnabled: boolOf(cfg, "enable_support"),
    primeTowerEnabled: boolOf(cfg, "enable_prime_tower"),
  };
}

// ── Estimación de tiempo desde la malla ───────────────────────────────────────

/**
 * Estimación volumétrica de tiempo, sólo para archivos sin laminar.
 *
 * ADVERTENCIA (H-02, pendiente): el factor 0,15 no está calibrado contra ningún
 * dato real. No modela aceleración, número de capas, desplazamientos, el techo
 * de flujo volumétrico del hotend, soportes ni torre de purga. Sirve como orden
 * de magnitud y nada más — por eso la UI lo marca como estimado.
 *
 * Cuando el archivo trae datos del laminador (`slicerReport`) esta función no se
 * usa: ahí el tiempo es exacto.
 */
export const TIME_ESTIMATE_EFFICIENCY = 0.15;

export function estimatePrintTime(materialMm3: number, p: SlicingParams): number {
  const weightedSpeed =
    0.25 * p.outerWallSpeed +
    0.20 * p.innerWallSpeed +
    0.30 * p.infillSpeed +
    0.25 * p.solidInfillSpeed;

  const theoreticalFlow = weightedSpeed * p.layerHeight * p.lineWidth;
  const effectiveFlow = theoreticalFlow * TIME_ESTIMATE_EFFICIENCY;

  return effectiveFlow > 0 ? materialMm3 / effectiveFlow : 0;
}

// ── Lectura del .3mf ──────────────────────────────────────────────────────────

export async function parse3MF(file: File): Promise<Parse3MFResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("No se pudo leer el archivo. Verificá que sea un .3mf válido.");
  }

  // 1. Datos exactos del laminador, si el archivo fue exportado después de
  //    laminar. Es lo primero que se busca: si existen, no hay nada que estimar.
  let slicerReport: SlicerReport | undefined;

  const sliceInfoEntry = zip.file("Metadata/slice_info.config");
  if (sliceInfoEntry) {
    slicerReport = parseSliceInfo(await sliceInfoEntry.async("text")) ?? undefined;
  }

  // Algunos laminadores empaquetan el G-code sin slice_info; el resumen en
  // comentarios sirve igual.
  if (!slicerReport) {
    const gcodeName = Object.keys(zip.files).find((n) => /\.gcode$/i.test(n));
    if (gcodeName) {
      const text = await zip.files[gcodeName].async("text");
      slicerReport = parseGcodeSummary(text) ?? undefined;
    }
  }

  // 2. Perfil del laminador.
  let profile: ProfileInfo = { filaments: [] };
  const settingsEntry = zip.file("Metadata/project_settings.config");
  if (settingsEntry) {
    profile = readProfile(await settingsEntry.async("text"));
  }

  // 3. Geometría. Un .3mf laminado no lleva malla (sus <resources> vienen
  //    vacíos), y eso ya no es un error.
  const geometry = await readGeometry(zip);

  if (!slicerReport && geometry.volumeMm3 === 0 && geometry.vertexCount === 0) {
    throw new Error(
      "No se encontró geometría imprimible ni datos del laminador en el archivo."
    );
  }

  return {
    fileName: file.name,
    slicerReport,
    totalVolumeMm3: geometry.volumeMm3,
    areas: geometry.areas,
    dimensions: geometry.dimensions,
    vertexCount: geometry.vertexCount,
    triangleCount: geometry.triangleCount,
    filamentDensity: profile.filamentDensity,
    filamentType: profile.filamentType,
    filamentFlowRatio: profile.filamentFlowRatio,
    filamentDiameter: profile.filamentDiameter,
    filaments: profile.filaments.length ? profile.filaments : undefined,
    printerModel: profile.printerModel,
    shellParams: profile.shellParams,
    slicingParams: profile.slicingParams,
    supportEnabled: profile.supportEnabled,
    primeTowerEnabled: profile.primeTowerEnabled,
  };
}

interface GeometryResult {
  volumeMm3: number;
  areas: MeshAreas;
  dimensions: { x: number; y: number; z: number };
  vertexCount: number;
  triangleCount: number;
}

async function readGeometry(zip: JSZip): Promise<GeometryResult> {
  const empty: GeometryResult = {
    volumeMm3: 0,
    areas: { lateralMm2: 0, topMm2: 0, bottomMm2: 0 },
    dimensions: { x: 0, y: 0, z: 0 },
    vertexCount: 0,
    triangleCount: 0,
  };

  const mainEntry = zip.file("3D/3dmodel.model");
  if (!mainEntry) return empty;

  const docCache = new Map<string, Map<string, ObjectEntry>>();

  async function loadDoc(rawPath: string): Promise<Map<string, ObjectEntry> | null> {
    const path = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
    if (docCache.has(path)) return docCache.get(path)!;

    const entry = zip.file(path);
    if (!entry) return null;

    const objs = parseModelDoc(await entry.async("text"));
    docCache.set(path, objs);
    return objs;
  }

  let totalVolume = 0;
  let totalVerts = 0;
  let totalTris = 0;
  const areas: MeshAreas = { lateralMm2: 0, topMm2: 0, bottomMm2: 0 };
  const bbox = {
    minX: Infinity, maxX: -Infinity,
    minY: Infinity, maxY: -Infinity,
    minZ: Infinity, maxZ: -Infinity,
  };

  function processMesh(mesh: RawMesh, transform: Mat4x3) {
    const transformed = applyTransform(mesh.vertices, transform);
    const measured = measureMesh(transformed, mesh.triangles);

    totalVolume += Math.abs(measured.signedVolume);
    areas.lateralMm2 += measured.areas.lateralMm2;
    areas.topMm2 += measured.areas.topMm2;
    areas.bottomMm2 += measured.areas.bottomMm2;
    totalVerts += mesh.vertices.length / 3;
    totalTris += mesh.triangles.length / 3;
    updateBBox(transformed, bbox);
  }

  async function resolveObject(
    entry: ObjectEntry,
    transform: Mat4x3,
    sourceDoc: Map<string, ObjectEntry>,
    sourcePath: string
  ) {
    // Sólo cuenta la geometría imprimible.
    if (entry.type !== "model") return;

    if (entry.mesh) processMesh(entry.mesh, transform);

    if (entry.components) {
      for (const comp of entry.components) {
        const compTransform = multiplyTransforms(comp.transform, transform);
        const targetDoc = comp.path ? await loadDoc(comp.path) : sourceDoc;
        if (!targetDoc) continue;
        const targetEntry = targetDoc.get(comp.objectId);
        if (!targetEntry) continue;
        await resolveObject(targetEntry, compTransform, targetDoc, comp.path || sourcePath);
      }
    }
  }

  const mainXml = await mainEntry.async("text");
  const mainDoc = parseModelDoc(mainXml);
  docCache.set("3D/3dmodel.model", mainDoc);

  const rootDoc = new DOMParser().parseFromString(mainXml, "application/xml");
  const itemEls = rootDoc.getElementsByTagName("item");

  if (itemEls.length === 0) {
    for (const [, entry] of mainDoc) {
      await resolveObject(entry, IDENTITY, mainDoc, "3D/3dmodel.model");
    }
  } else {
    for (let i = 0; i < itemEls.length; i++) {
      const item = itemEls[i];
      const objectId = item.getAttribute("objectid") ?? "";
      const itemTransform = parseTransform(item.getAttribute("transform"));
      const itemPath =
        item.getAttributeNS(PRODUCTION_NS, "path") ?? item.getAttribute("p:path") ?? "";

      let entry: ObjectEntry | undefined;
      let sourceDoc = mainDoc;
      let docPath = "3D/3dmodel.model";

      if (itemPath) {
        const extDoc = await loadDoc(itemPath);
        if (extDoc) {
          entry = extDoc.get(objectId);
          sourceDoc = extDoc;
          docPath = itemPath.startsWith("/") ? itemPath.slice(1) : itemPath;
        }
      } else {
        entry = mainDoc.get(objectId);
      }

      if (!entry) continue;
      await resolveObject(entry, itemTransform, sourceDoc, docPath);
    }
  }

  // Respaldo para layouts no estándar donde los objetos viven en archivos
  // externos que no se referenciaron vía p:path.
  if (totalVerts === 0) {
    const modelFiles = Object.keys(zip.files).filter(
      (name) => name.endsWith(".model") && name !== "3D/3dmodel.model"
    );
    for (const modelPath of modelFiles) {
      const doc = await loadDoc(modelPath);
      if (!doc) continue;
      for (const [, entry] of doc) {
        await resolveObject(entry, IDENTITY, doc, modelPath);
      }
    }
  }

  if (totalVerts === 0) return empty;

  return {
    volumeMm3: totalVolume,
    areas,
    dimensions: {
      x: isFinite(bbox.maxX) ? Math.abs(bbox.maxX - bbox.minX) : 0,
      y: isFinite(bbox.maxY) ? Math.abs(bbox.maxY - bbox.minY) : 0,
      z: isFinite(bbox.maxZ) ? Math.abs(bbox.maxZ - bbox.minZ) : 0,
    },
    vertexCount: totalVerts,
    triangleCount: totalTris,
  };
}
