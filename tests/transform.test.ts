import { describe, expect, it } from "vitest";
import {
  IDENTITY,
  applyTransform,
  multiplyTransforms,
  parseTransform,
  type Mat4x3,
} from "@/src/lib/print/transform";

function bbox(verts: Float64Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], verts[i + a]);
      max[a] = Math.max(max[a], verts[i + a]);
    }
  }
  return { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
}

/** Los 8 vértices de una caja apoyada en el origen. */
function boxVerts(x: number, y: number, z: number): Float64Array {
  const out: number[] = [];
  for (const vx of [0, x]) for (const vy of [0, y]) for (const vz of [0, z]) out.push(vx, vy, vz);
  return new Float64Array(out);
}

describe("transformaciones 3MF (H-07)", () => {
  it("la traslación va en los tres últimos valores", () => {
    const t = parseTransform("1 0 0 0 1 0 0 0 1 10 20 30");
    const out = applyTransform(new Float64Array([1, 2, 3]), t);
    expect([...out]).toEqual([11, 22, 33]);
  });

  it("aplica la convención de vector-fila, no su transpuesta", () => {
    // Rotación de 90° alrededor de X, en la convención de la spec:
    // filas = (1,0,0) (0,0,1) (0,-1,0) → p' = p·M lleva +Y a +Z.
    const t = parseTransform("1 0 0 0 0 1 0 -1 0 0 0 0");
    const out = applyTransform(new Float64Array([0, 1, 0]), t);
    expect(out[0]).toBeCloseTo(0, 12);
    expect(out[1]).toBeCloseTo(0, 12);
    expect(out[2]).toBeCloseTo(1, 12);

    // Con la transpuesta el resultado sería (0, -1, 0): el bug original.
    expect(out[1]).not.toBeCloseTo(-1, 6);
  });

  it("una caja rotada 90° en X intercambia Y y Z en la caja envolvente", () => {
    const verts = boxVerts(10, 40, 5);
    const rotated = applyTransform(verts, parseTransform("1 0 0 0 0 1 0 -1 0 0 0 0"));
    const dims = bbox(rotated);
    expect(dims.x).toBeCloseTo(10, 10);
    expect(dims.y).toBeCloseTo(5, 10);
    expect(dims.z).toBeCloseTo(40, 10);
  });

  it("con el transform real del Spider-Noir la transpuesta da otro punto", () => {
    // Transform del <item> real: escala 4,2 y rotación en X.
    // Medido sobre la malla: 67,66 × 92,64 × 57,48 mm.
    // El código transpuesto reportaba 67,66 × 76,55 × 72,80 mm — un 27 % de
    // error en la altura.
    //
    // Ojo: sobre una caja alineada a los ejes la transpuesta de una rotación da
    // la misma caja envolvente (sólo cambian signos), así que el bug hay que
    // cazarlo sobre un punto concreto, no sobre las dimensiones de un ortoedro.
    const t = parseTransform(
      "4.2 0 0 0 1.7749967 -3.8064927 0 3.8064927 1.7749967 128.200012 125.141205 33.4569032"
    );

    const correcto = applyTransform(new Float64Array([1, 2, 3]), t);
    expect(correcto[0]).toBeCloseTo(132.400012, 6);
    expect(correcto[1]).toBeCloseTo(140.1106765, 6);
    expect(correcto[2]).toBeCloseTo(31.1689079, 6);

    const transpuesta: Mat4x3 = [
      t[0], t[3], t[6],
      t[1], t[4], t[7],
      t[2], t[5], t[8],
      t[9], t[10], t[11],
    ];
    const bug = applyTransform(new Float64Array([1, 2, 3]), transpuesta);
    expect(bug[1]).toBeCloseTo(117.2717203, 6);
    expect(bug[2]).toBeCloseTo(46.3948787, 6);
    expect(correcto[2]).not.toBeCloseTo(bug[2], 3);
  });

  it("una nube de puntos rotada distingue la matriz de su transpuesta", () => {
    const t = parseTransform(
      "4.2 0 0 0 1.7749967 -3.8064927 0 3.8064927 1.7749967 128.200012 125.141205 33.4569032"
    );
    // Malla asimétrica: un tetraedro irregular.
    const verts = new Float64Array([0, 0, 0, 12, 1, 2, 2, 18, 3, 1, 4, 9]);
    const transpuesta: Mat4x3 = [
      t[0], t[3], t[6],
      t[1], t[4], t[7],
      t[2], t[5], t[8],
      t[9], t[10], t[11],
    ];

    const dims = bbox(applyTransform(verts, t));
    const wrong = bbox(applyTransform(verts, transpuesta));

    expect(dims.x).toBeCloseTo(wrong.x, 10); // la rotación es en X: no la toca
    expect(dims.y).not.toBeCloseTo(wrong.y, 3);
    expect(dims.z).not.toBeCloseTo(wrong.z, 3);
  });

  it("componer con la identidad no cambia nada", () => {
    const t = parseTransform("2 0 0 0 3 0 0 0 4 5 6 7");
    expect(multiplyTransforms(t, IDENTITY)).toEqual(t);
    expect(multiplyTransforms(IDENTITY, t)).toEqual(t);
  });

  it("componer aplica primero el hijo y después el padre", () => {
    // Hijo: escala ×2. Padre: traslación +100 en X.
    const child = parseTransform("2 0 0 0 2 0 0 0 2 0 0 0");
    const parent = parseTransform("1 0 0 0 1 0 0 0 1 100 0 0");
    const combined = multiplyTransforms(child, parent);

    const out = applyTransform(new Float64Array([1, 0, 0]), combined);
    // Escalar y después trasladar: 1·2 + 100 = 102.
    expect(out[0]).toBeCloseTo(102, 10);
    // El orden inverso daría (1 + 100)·2 = 202.
    expect(out[0]).not.toBeCloseTo(202, 6);
  });

  it("un transform inválido cae a la identidad", () => {
    expect(parseTransform("1 2 3")).toEqual(IDENTITY);
    expect(parseTransform(null)).toEqual(IDENTITY);
    expect(parseTransform("a b c d e f g h i j k l")).toEqual(IDENTITY);
  });
});
