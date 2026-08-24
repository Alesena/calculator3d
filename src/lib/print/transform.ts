/**
 * Matrices de transformación 3MF (H-07).
 *
 * El atributo `transform` son 12 valores en convención de vector-fila:
 *
 *   [m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32]
 *
 *        | m00 m01 m02 0 |
 *   M =  | m10 m11 m12 0 |     y el punto se aplica como  p' = p · M
 *        | m20 m21 m22 0 |
 *        | m30 m31 m32 1 |
 *
 * Es decir  x' = m00·x + m10·y + m20·z + m30.
 *
 * La versión anterior aplicaba la transpuesta (x' = m00·x + m01·y + m02·z).
 * Con escala y traslación puras da lo mismo; en cuanto hay rotación las
 * dimensiones salen mal. El volumen no se veía afectado porque
 * det(M) = det(Mᵀ).
 */
export type Mat4x3 = [
  number, number, number,
  number, number, number,
  number, number, number,
  number, number, number
];

export const IDENTITY: Mat4x3 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export function parseTransform(s: string | null | undefined): Mat4x3 {
  if (!s) return IDENTITY;
  const v = s.trim().split(/\s+/).map(Number);
  if (v.length === 12 && v.every((n) => Number.isFinite(n))) return v as Mat4x3;
  return IDENTITY;
}

/** Transforma un buffer plano de vértices [x,y,z, x,y,z, …]. */
export function applyTransform(verts: Float64Array, t: Mat4x3): Float64Array {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22, m30, m31, m32] = t;
  const out = new Float64Array(verts.length);
  for (let i = 0; i < verts.length; i += 3) {
    const x = verts[i], y = verts[i + 1], z = verts[i + 2];
    out[i]     = m00 * x + m10 * y + m20 * z + m30;
    out[i + 1] = m01 * x + m11 * y + m21 * z + m31;
    out[i + 2] = m02 * x + m12 * y + m22 * z + m32;
  }
  return out;
}

/**
 * Composición `a · b`: aplicar primero `a` y después `b`.
 *
 * Para anidar un componente dentro de un item, el punto local viaja
 * `p · C · P`, así que la matriz combinada es `multiply(componente, padre)`.
 */
export function multiplyTransforms(a: Mat4x3, b: Mat4x3): Mat4x3 {
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22, a30, a31, a32] = a;
  const [b00, b01, b02, b10, b11, b12, b20, b21, b22, b30, b31, b32] = b;
  return [
    a00 * b00 + a01 * b10 + a02 * b20,
    a00 * b01 + a01 * b11 + a02 * b21,
    a00 * b02 + a01 * b12 + a02 * b22,
    a10 * b00 + a11 * b10 + a12 * b20,
    a10 * b01 + a11 * b11 + a12 * b21,
    a10 * b02 + a11 * b12 + a12 * b22,
    a20 * b00 + a21 * b10 + a22 * b20,
    a20 * b01 + a21 * b11 + a22 * b21,
    a20 * b02 + a21 * b12 + a22 * b22,
    a30 * b00 + a31 * b10 + a32 * b20 + b30,
    a30 * b01 + a31 * b11 + a32 * b21 + b31,
    a30 * b02 + a31 * b12 + a32 * b22 + b32,
  ];
}
