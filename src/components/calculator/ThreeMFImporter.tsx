"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileBox,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Info,
  AlertTriangle,
  Layers,
  RotateCcw,
} from "lucide-react";
import { estimatePrintTime } from "@/lib/parse3mf";
import {
  importPrintFile,
  isSupportedPrintFile,
  type PrintImport,
} from "@/lib/print/importFile";
import {
  DEFAULT_SHELL_PARAMS,
  estimateMaterialVolume,
  materialMass,
  type ShellParams,
} from "@/lib/print/shell";
import { FILAMENT_DENSITIES, resolveDensity } from "@/lib/print/materials";

export interface ThreeMFImportData {
  filamentWeightGrams: number;
  volumeMm3?: number;
  printTimeHours?: number;
  printTimeMinutes?: number;
}

interface Props {
  onApply: (data: ThreeMFImportData) => void;
}

interface TimeHM {
  h: number;
  m: number;
}

function secsToHM(secs: number): TimeHM {
  const total = Math.max(0, Math.round(secs / 60));
  return { h: Math.floor(total / 60), m: total % 60 };
}

export function ThreeMFImporter({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [result, setResult] = useState<PrintImport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estimación desde la malla. Se inicializan con lo que dice el archivo.
  const [density, setDensity] = useState(FILAMENT_DENSITIES.PLA);
  const [densityKey, setDensityKey] = useState<string>("PLA");
  const [infill, setInfill] = useState(DEFAULT_SHELL_PARAMS.infillDensity * 100);
  const [supportPct, setSupportPct] = useState(0);
  const [purgeGrams, setPurgeGrams] = useState(0);

  /** null = usar el valor derivado del archivo. */
  const [timeOverride, setTimeOverride] = useState<TimeHM | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const report = result?.slicerReport;
  const mesh = result?.mesh;
  /** Con datos del laminador no hay nada que estimar. */
  const exact = Boolean(report);

  const shellParams: ShellParams = useMemo(
    () => ({
      ...DEFAULT_SHELL_PARAMS,
      ...(result?.profile.shellParams ?? {}),
      infillDensity: infill / 100,
    }),
    [result, infill]
  );

  // Peso del objeto según el modelo de cáscara (H-01).
  const shell = useMemo(() => {
    if (!mesh) return null;
    return estimateMaterialVolume(mesh.volumeMm3, mesh.areas, shellParams);
  }, [mesh, shellParams]);

  const flowRatio = result?.profile.filamentFlowRatio ?? 1;

  const weights = useMemo(() => {
    if (report) {
      return { object: report.weightGrams, support: 0, purge: 0, total: report.weightGrams };
    }
    if (!shell) return { object: 0, support: 0, purge: 0, total: 0 };
    const object = materialMass(shell.materialMm3, density, flowRatio);
    const support = object * (supportPct / 100);
    return { object, support, purge: purgeGrams, total: object + support + purgeGrams };
  }, [report, shell, density, flowRatio, supportPct, purgeGrams]);

  // Tiempo: exacto si viene del laminador, estimado si sale de la malla.
  const derivedTime = useMemo<TimeHM | null>(() => {
    if (report?.printTimeSeconds) return secsToHM(report.printTimeSeconds);
    if (shell && result?.profile.slicingParams) {
      return secsToHM(estimatePrintTime(shell.materialMm3, result.profile.slicingParams));
    }
    return null;
  }, [report, shell, result]);

  const time = timeOverride ?? derivedTime;

  async function processFile(file: File) {
    if (!isSupportedPrintFile(file.name)) {
      setError("Formato no soportado. Subí un .3mf o un .gcode.");
      setStatus("error");
      return;
    }
    setStatus("parsing");
    setError(null);
    setResult(null);
    setTimeOverride(null);
    setSupportPct(0);
    setPurgeGrams(0);

    try {
      const parsed = await importPrintFile(file);
      setResult(parsed);
      setStatus("done");

      // El archivo manda: densidad primero, tabla como respaldo (H-05).
      const resolved = resolveDensity(
        parsed.profile.filamentDensity,
        parsed.profile.filamentType ?? parsed.slicerReport?.filaments[0]?.type
      );
      setDensity(resolved.density);
      setDensityKey(resolved.from === "file" ? "custom" : parsed.profile.filamentType ?? "PLA");

      // El relleno arranca en el valor del archivo, no en un 20 % fijo (H-04).
      const fileInfill = parsed.profile.shellParams?.infillDensity;
      setInfill(
        fileInfill !== undefined
          ? Math.round(fileInfill * 100)
          : DEFAULT_SHELL_PARAMS.infillDensity * 100
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al leer el archivo");
      setStatus("error");
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDensityChange(key: string) {
    setDensityKey(key);
    if (key !== "custom") setDensity(FILAMENT_DENSITIES[key]);
  }

  function handleApply() {
    if (!result) return;
    onApply({
      filamentWeightGrams: parseFloat(weights.total.toFixed(2)),
      volumeMm3: mesh?.volumeMm3,
      printTimeHours: time?.h,
      printTimeMinutes: time?.m,
    });
    setOpen(false);
  }

  function handleReset() {
    setStatus("idle");
    setResult(null);
    setError(null);
    setTimeOverride(null);
  }

  const sectionCls =
    "bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden";
  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow";
  const labelCls =
    "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide";

  return (
    <div className={sectionCls}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <FileBox className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              Importar archivo del laminador
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              .3mf o .gcode — si está laminado, toma el peso y el tiempo exactos
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {(status === "idle" || status === "error") && (
            <>
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-8 cursor-pointer transition-all duration-150 select-none",
                  dragging
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-gray-50 dark:hover:bg-gray-700/40",
                ].join(" ")}
              >
                <div
                  className={[
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    dragging
                      ? "bg-orange-100 dark:bg-orange-900/40"
                      : "bg-gray-100 dark:bg-gray-700",
                  ].join(" ")}
                >
                  <Upload
                    className={`w-6 h-6 ${dragging ? "text-orange-500" : "text-gray-500"}`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {dragging ? "Soltá el archivo acá" : "Arrastrá tu .3mf o .gcode"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">o hacé click para seleccionar</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".3mf,.gcode,.gco,.g"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Para el resultado más preciso, exportá desde el laminador{" "}
                <strong>después de laminar</strong> — así el archivo trae el peso y el tiempo que
                calculó el propio slicer, purga y soportes incluidos.
              </p>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}

          {status === "parsing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Leyendo el archivo…</p>
            </div>
          )}

          {status === "done" && result && (
            <div className="space-y-4">
              {/* Archivo + procedencia del dato */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500 shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-300 truncate font-medium">
                    {result.fileName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                  aria-label="Cambiar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <SourceBadge exact={exact} producer={report?.producer} />

              {exact && report ? (
                <ExactPanel report={report} />
              ) : (
                <>
                  {mesh && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Volumen", value: `${(mesh.volumeMm3 / 1000).toFixed(2)} cm³` },
                        {
                          label: "Dimensiones",
                          value: `${mesh.dimensions.x.toFixed(0)}×${mesh.dimensions.y.toFixed(0)}×${mesh.dimensions.z.toFixed(0)} mm`,
                        },
                        {
                          label: "Triángulos",
                          value: mesh.triangleCount.toLocaleString("es-AR"),
                        },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 text-center"
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 leading-tight">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.profile.shellParams && (
                    <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        Perfil detectado: {result.profile.shellParams.wallLoops} paredes,{" "}
                        {result.profile.shellParams.topShellLayers}+
                        {result.profile.shellParams.bottomShellLayers} capas sólidas, capa{" "}
                        {result.profile.shellParams.layerHeight} mm
                        {result.profile.printerModel ? ` · ${result.profile.printerModel}` : ""}
                      </span>
                    </div>
                  )}

                  {/* Material */}
                  <div className="space-y-2">
                    <label className={labelCls}>Material del filamento</label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(FILAMENT_DENSITIES).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleDensityChange(key)}
                          className={[
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            densityKey === key
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600",
                          ].join(" ")}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="densidad"
                        className="text-xs text-gray-500 dark:text-gray-400 shrink-0"
                      >
                        Densidad (g/cm³):
                      </label>
                      <input
                        id="densidad"
                        type="number"
                        min="0.5"
                        max="3"
                        step="0.01"
                        value={density}
                        onChange={(e) => {
                          setDensityKey("custom");
                          setDensity(parseFloat(e.target.value) || FILAMENT_DENSITIES.PLA);
                        }}
                        className={inputCls + " text-xs py-1.5"}
                      />
                    </div>
                    {result.profile.filamentDensity && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        El archivo declara {result.profile.filamentDensity} g/cm³
                        {result.profile.filamentType ? ` (${result.profile.filamentType})` : ""}
                        {flowRatio !== 1 ? ` · factor de flujo ${flowRatio}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Relleno */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="relleno" className={labelCls}>
                        Relleno (infill)
                      </label>
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                        {infill}%
                      </span>
                    </div>
                    <input
                      id="relleno"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={infill}
                      onChange={(e) => setInfill(Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                    {result.profile.shellParams && (
                      <InfillHint
                        fileValue={Math.round(result.profile.shellParams.infillDensity * 100)}
                        current={infill}
                        onReset={() =>
                          setInfill(
                            Math.round(result.profile.shellParams!.infillDensity * 100)
                          )
                        }
                      />
                    )}
                  </div>

                  {/* Merma: soportes y purga (H-06) */}
                  <div className="space-y-2">
                    <label className={labelCls}>Merma</label>
                    {(result.profile.supportEnabled || result.profile.primeTowerEnabled) && (
                      <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          El perfil tiene{" "}
                          {[
                            result.profile.supportEnabled ? "soportes" : null,
                            result.profile.primeTowerEnabled ? "torre de purga" : null,
                          ]
                            .filter(Boolean)
                            .join(" y ")}{" "}
                          activados. Una estimación desde la malla no los incluye — cargalos acá o
                          importá el archivo laminado para tener el número exacto.
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label
                          htmlFor="soportes"
                          className="text-xs text-gray-500 dark:text-gray-400"
                        >
                          Soportes (% del objeto)
                        </label>
                        <input
                          id="soportes"
                          type="number"
                          min="0"
                          max="200"
                          step="1"
                          value={supportPct}
                          onChange={(e) =>
                            setSupportPct(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="purga" className="text-xs text-gray-500 dark:text-gray-400">
                          Purga / torre (g)
                        </label>
                        <input
                          id="purga"
                          type="number"
                          min="0"
                          step="0.1"
                          value={purgeGrams}
                          onChange={(e) =>
                            setPurgeGrams(Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Peso y tiempo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                  <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                    Peso filamento
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-0.5 tabular-nums">
                    {weights.total.toFixed(2)} g
                  </p>
                  {exact ? (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Incluye purga y soportes
                    </p>
                  ) : (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-0.5 tabular-nums">
                      <p>Objeto {weights.object.toFixed(2)} g</p>
                      {weights.support > 0 && <p>Soportes {weights.support.toFixed(2)} g</p>}
                      {weights.purge > 0 && <p>Purga {weights.purge.toFixed(2)} g</p>}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                      {exact ? "Tiempo del laminador" : "Tiempo estimado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      aria-label="Horas"
                      value={time?.h ?? 0}
                      onChange={(e) =>
                        setTimeOverride({
                          h: Math.max(0, parseInt(e.target.value) || 0),
                          m: time?.m ?? 0,
                        })
                      }
                      className="w-12 text-xl font-bold text-blue-600 dark:text-blue-400 bg-transparent border-0 outline-none p-0 text-center tabular-nums"
                    />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">h</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      aria-label="Minutos"
                      value={time?.m ?? 0}
                      onChange={(e) =>
                        setTimeOverride({
                          h: time?.h ?? 0,
                          m: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-12 text-xl font-bold text-blue-600 dark:text-blue-400 bg-transparent border-0 outline-none p-0 text-center tabular-nums"
                    />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      min
                    </span>
                  </div>
                  {timeOverride ? (
                    <button
                      type="button"
                      onClick={() => setTimeOverride(null)}
                      className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline mt-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Volver al valor del archivo
                    </button>
                  ) : (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {exact ? "Dato exacto" : derivedTime ? "Orden de magnitud" : "Cargalo a mano"}
                    </p>
                  )}
                </div>
              </div>

              {!exact && derivedTime && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    El tiempo estimado desde la malla no modela aceleración, cambio de capa ni
                    desplazamientos: tomalo como orden de magnitud y corregilo a mano. El peso, en
                    cambio, sí considera paredes y capas sólidas.
                  </span>
                </div>
              )}

              {!exact && !mesh && (
                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  El archivo no trae malla ni datos del laminador. Cargá el peso y el tiempo a mano.
                </div>
              )}

              <button
                type="button"
                onClick={handleApply}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all duration-150 shadow-sm shadow-orange-200 dark:shadow-orange-900/20"
              >
                {/* El formulario trabaja en gramos enteros redondeados hacia
                    arriba: mostramos lo que realmente va a quedar cargado, no
                    el decimal del archivo. */}
                Usar en el formulario → {Math.ceil(parseFloat(weights.total.toFixed(2)))} g
                {time && (time.h > 0 || time.m > 0) ? ` / ${time.h}h ${time.m}min` : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ exact, producer }: { exact: boolean; producer?: string }) {
  if (exact) {
    return (
      <div className="flex items-start gap-2 text-xs bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg px-3 py-2">
        <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Datos exactos del laminador</strong>
          {producer ? ` · ${producer}` : ""}. El peso y el tiempo son los que calculó el mismo
          motor que va a imprimir la pieza.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-lg px-3 py-2">
      <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>
        <strong>Estimado desde la malla</strong>. Es un proyecto sin laminar: los números salen de
        la geometría y del perfil. Exportá el archivo laminado para tener el valor exacto.
      </span>
    </div>
  );
}

function InfillHint({
  fileValue,
  current,
  onReset,
}: {
  fileValue: number;
  current: number;
  onReset: () => void;
}) {
  if (current === fileValue) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Tomado del archivo ({fileValue}%).
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onReset}
      className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
    >
      <RotateCcw className="w-3 h-3" /> El archivo dice {fileValue}% — volver a ese valor
    </button>
  );
}

function ExactPanel({
  report,
}: {
  report: NonNullable<PrintImport["slicerReport"]>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          report.layerCount !== undefined
            ? { label: "Capas", value: report.layerCount.toLocaleString("es-AR") }
            : null,
          report.filaments.length > 1
            ? { label: "Filamentos", value: String(report.filaments.length) }
            : null,
          report.filamentChanges !== undefined
            ? { label: "Cambios", value: String(report.filamentChanges) }
            : null,
          report.supportUsed !== undefined
            ? { label: "Soportes", value: report.supportUsed ? "Sí" : "No" }
            : null,
        ]
          .filter((x): x is { label: string; value: string } => x !== null)
          .slice(0, 3)
          .map(({ label, value }) => (
            <div key={label} className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{value}</p>
            </div>
          ))}
      </div>

      {report.filaments.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Por filamento
          </p>
          {report.filaments.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-xs">
              <span
                className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 shrink-0"
                style={f.color ? { backgroundColor: f.color } : undefined}
                aria-hidden="true"
              />
              <span className="text-gray-600 dark:text-gray-300">
                {f.type ?? "Filamento"} {f.id}
              </span>
              <span className="ml-auto font-medium text-gray-900 dark:text-white tabular-nums">
                {f.grams.toFixed(2)} g
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
