import { describe, expect, it } from "vitest";
import {
  isValidCuit, normalizeWhatsapp, validatePricingParams, validateQuoteBody, validateRequestBody, ValidationError,
} from "@/src/lib/pricing/validation";
import { DEFAULT_PRICING_PARAMS } from "@/src/lib/pricing/defaults";
import { addBusinessHours, isoBuenosAires, localDatePlusDays } from "@/src/lib/pricing/time";
import { confirmationMessage, trackingUrl } from "@/src/lib/pricing/messages";
import type { StoredQuote } from "@/src/lib/pricing/public";

const P = DEFAULT_PRICING_PARAMS;
const body = {
  material: "PETG", quality: "standard", use: "functional", volume_cm3: 38,
  bbox_mm: [80, 45, 40], quantity: 4, color: "black", file_name: "a.stl", session_id: "s",
};

const fieldOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ValidationError ? e.field : "otro error";
  }
  return null;
};

describe("validateQuoteBody", () => {
  it("acepta un pedido válido", () => {
    expect(validateQuoteBody(body, P).quantity).toBe(4);
  });
  it("acepta piezas y camas", () => {
    const b = validateQuoteBody({ ...body, parts: 3, plates: 2 }, P);
    expect([b.parts, b.plates]).toEqual([3, 2]);
  });
  it.each([
    [{ quantity: 0 }, "quantity"],
    [{ quantity: 1.5 }, "quantity"],
    [{ quantity: 501 }, "quantity"],
    [{ volume_cm3: 0.05 }, "volume_cm3"],
    [{ volume_cm3: 20001 }, "volume_cm3"],
    [{ bbox_mm: [80, 45] }, "bbox_mm"],
    [{ material: "ASA" }, "material"], // inactivo en los defaults
    [{ color: "red" }, "color"], // PETG no tiene rojo
    [{ supports: "todos" }, "supports"],
    [{ use: "otro" }, "use"],
    [{ parts: 0 }, "parts"],
    [{ parts: 2.5 }, "parts"],
    [{ plates: 0 }, "plates"],
    [{ plates: 101 }, "plates"],
  ])("rechaza %o", (patch, field) => {
    expect(fieldOf(() => validateQuoteBody({ ...body, ...patch }, P))).toBe(field);
  });
  it("rechaza un color sin stock", () => {
    const params = structuredClone(P);
    params.materials[1].colors[2].available = false; // PETG negro
    expect(fieldOf(() => validateQuoteBody(body, params))).toBe("color");
  });
});

describe("normalizeWhatsapp", () => {
  it.each([
    ["11 5555-0123", "+5491155550123"],
    ["011 15 5555 0123", "+5491155550123"],
    ["+54 9 11 5555 0123", "+5491155550123"],
    ["5491155550123", "+5491155550123"],
    ["+54 11 5555 0123", "+5491155550123"],
    ["351 15 555 0123", "+5493515550123"],
    ["+598 99 123 456", "+59899123456"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizeWhatsapp(raw)).toBe(e164);
  });
  it("rechaza lo que no se entiende", () => {
    expect(normalizeWhatsapp("1234")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
  });
});

describe("validateRequestBody", () => {
  const ok = { name: "Lucía", whatsapp: "11 5555 0123", delivery: { method: "pickup" } };
  it("normaliza y aplica factura B por defecto", () => {
    const r = validateRequestBody(ok);
    expect(r.whatsapp).toBe("+5491155550123");
    expect(r.invoice).toEqual({ type: "B" });
    expect(r.email).toBeNull();
  });
  it("envío exige código postal", () => {
    expect(fieldOf(() => validateRequestBody({ ...ok, delivery: { method: "shipping" } }))).toBe("postal_code");
  });
  it("factura A exige CUIT válido", () => {
    const inv = { type: "A", cuit: "20-12345678-5", business_name: "ACME SA" };
    expect(fieldOf(() => validateRequestBody({ ...ok, invoice: inv }))).toBe("cuit");
    expect(validateRequestBody({ ...ok, invoice: { ...inv, cuit: "20-12345678-6" } }).invoice).toMatchObject({ cuit: "20123456786" });
  });
});

describe("isValidCuit", () => {
  it("dígito verificador", () => {
    expect(isValidCuit("20123456786")).toBe(true);
    expect(isValidCuit("20123456785")).toBe(false);
  });
});

describe("validatePricingParams", () => {
  it("acepta los parámetros por defecto", () => {
    expect(() => validatePricingParams(P)).not.toThrow();
  });
  it("rechaza un uso que recomienda un material inexistente", () => {
    const bad = structuredClone(P);
    bad.uses[0].material = "NADA";
    expect(fieldOf(() => validatePricingParams(bad))).toBe("uses");
  });
  it("rechaza colores repetidos", () => {
    const bad = structuredClone(P);
    bad.materials[0].colors.push({ ...bad.materials[0].colors[0] });
    expect(fieldOf(() => validatePricingParams(bad))).toBe("materials");
  });
});

describe("horario hábil (Buenos Aires)", () => {
  const bh = P.business_hours;
  // 2026-09-25 es viernes.
  it("martes 10:00 + 2 h → 12:00", () => {
    const at = addBusinessHours(new Date("2026-09-22T13:00:00Z"), 2, bh);
    expect(isoBuenosAires(at)).toBe("2026-09-22T12:00:00-03:00");
  });
  it("viernes 17:30 + 2 h → lunes 10:30", () => {
    const at = addBusinessHours(new Date("2026-09-25T20:30:00Z"), 2, bh);
    expect(isoBuenosAires(at)).toBe("2026-09-28T10:30:00-03:00");
  });
  it("sábado → lunes 11:00", () => {
    const at = addBusinessHours(new Date("2026-09-26T15:00:00Z"), 2, bh);
    expect(isoBuenosAires(at)).toBe("2026-09-28T11:00:00-03:00");
  });
  it("antes de abrir arranca a las 9", () => {
    const at = addBusinessHours(new Date("2026-09-22T10:00:00Z"), 2, bh); // 07:00 local
    expect(isoBuenosAires(at)).toBe("2026-09-22T11:00:00-03:00");
  });
  it("la vigencia usa la fecha de Buenos Aires, no la UTC", () => {
    // 23:30 del 22 en BA = 02:30 UTC del 23
    expect(localDatePlusDays(new Date("2026-09-23T02:30:00Z"), 7)).toBe("2026-09-29");
  });
});

describe("mensaje de WhatsApp del admin", () => {
  const base = {
    id: "q_abc2345", public_token: "tok", input: { file_name: "soporte.stl" },
    customer: { name: "Lucía Fernández" }, estimated_total: 22750, max_guaranteed: 25050,
    payment_url: null, reason: null,
  };

  it("confirmada y más barata", () => {
    const q = { ...base, status: "confirmed", final_total: 20000, charged_total: 20000 } as unknown as StoredQuote;
    const msg = confirmationMessage(q, "https://misintenciones3d.com/impresion-3d");
    expect(msg).toContain("¡Hola Lucía!");
    expect(msg).toContain("$20.000");
    expect(msg).toContain("más barato");
    expect(msg).toContain("https://misintenciones3d.com/impresion-3d?q=q_abc2345&t=tok");
  });

  it("supera el tope: pide OK con el motivo", () => {
    const q = { ...base, status: "needs_acceptance", final_total: 30000, charged_total: null, reason: "Más soportes de lo previsto" } as unknown as StoredQuote;
    const msg = confirmationMessage(q, "https://x.com/impresion-3d");
    expect(msg).toContain("$30.000 porque más soportes de lo previsto");
    expect(msg).toContain("$25.050");
    expect(msg).not.toContain("Pagá acá");
  });

  it("trackingUrl", () => {
    expect(trackingUrl({ id: "q_a", public_token: "t" }, "https://x.com/p/")).toBe("https://x.com/p?q=q_a&t=t");
  });
});
