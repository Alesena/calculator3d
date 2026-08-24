import { describe, expect, it } from "vitest";
import {
  formatPrintTime,
  onlyDigits,
  parseGrams,
  parsePrintTime,
} from "@/src/lib/inputFormat";
import { formatDecimalHours } from "@/src/lib/calculations";

describe("parsePrintTime", () => {
  it("lee el punto como separador de minutos, no como decimal", () => {
    // Una hora y media, una hora y cuarto.
    expect(parsePrintTime("1.30")).toEqual({ hours: 1, minutes: 30 });
    expect(parsePrintTime("1.15")).toEqual({ hours: 1, minutes: 15 });
  });

  it("acepta horas sueltas", () => {
    expect(parsePrintTime("10")).toEqual({ hours: 10, minutes: 0 });
    expect(parsePrintTime("0")).toEqual({ hours: 0, minutes: 0 });
  });

  it("acepta minutos de un dígito", () => {
    expect(parsePrintTime("1.05")).toEqual({ hours: 1, minutes: 5 });
    expect(parsePrintTime("1.5")).toEqual({ hours: 1, minutes: 5 });
  });

  it("vacío es cero", () => {
    expect(parsePrintTime("")).toEqual({ hours: 0, minutes: 0 });
    expect(parsePrintTime("   ")).toEqual({ hours: 0, minutes: 0 });
  });

  it("tolera la coma para quien la escriba por costumbre", () => {
    expect(parsePrintTime("1,30")).toEqual({ hours: 1, minutes: 30 });
  });

  it("rechaza lo que no es un tiempo", () => {
    expect(parsePrintTime("1.60")).toBeNull(); // 60 minutos no existen
    expect(parsePrintTime("1.155")).toBeNull(); // tres dígitos de minutos
    expect(parsePrintTime("-1.30")).toBeNull();
    expect(parsePrintTime("abc")).toBeNull();
    expect(parsePrintTime("1.2.3")).toBeNull();
  });
});

describe("formatPrintTime", () => {
  it("rellena los minutos a dos dígitos", () => {
    expect(formatPrintTime(1, 5)).toBe("1.05");
    expect(formatPrintTime(1, 30)).toBe("1.30");
  });

  it("omite los minutos en cero y deja vacío el cero absoluto", () => {
    expect(formatPrintTime(10, 0)).toBe("10");
    expect(formatPrintTime(0, 0)).toBe("");
  });

  it("es la inversa de parsePrintTime", () => {
    for (const [h, m] of [
      [1, 30],
      [1, 15],
      [0, 45],
      [12, 5],
    ] as const) {
      expect(parsePrintTime(formatPrintTime(h, m))).toEqual({ hours: h, minutes: m });
    }
  });
});

describe("parseGrams", () => {
  it("lee gramos enteros", () => {
    expect(parseGrams("146")).toBe(146);
    expect(parseGrams("8")).toBe(8);
  });

  it("redondea hacia arriba lo que llega con decimales del importador .3mf", () => {
    expect(parseGrams(12.61)).toBe(13);
    expect(parseGrams(8.09)).toBe(9);
    expect(parseGrams("10.5")).toBe(11);
    expect(parseGrams(" 8,4 ")).toBe(9);
  });

  it("no infla los enteros exactos", () => {
    expect(parseGrams(8)).toBe(8);
    expect(parseGrams("8.0")).toBe(8);
  });

  it("cae en 0 con basura, para que el error lo dé el schema", () => {
    expect(parseGrams("abc")).toBe(0);
    expect(parseGrams("8.5g")).toBe(0);
    expect(parseGrams("")).toBe(0);
    expect(parseGrams(undefined)).toBe(0);
    expect(parseGrams(NaN)).toBe(0);
  });
});

describe("onlyDigits", () => {
  it("saca punto, coma y cualquier cosa que no sea dígito", () => {
    expect(onlyDigits("8.5")).toBe("85");
    expect(onlyDigits("1,5")).toBe("15");
    expect(onlyDigits("12a")).toBe("12");
    expect(onlyDigits("-3")).toBe("3");
    expect(onlyDigits("")).toBe("");
  });
});

describe("formatDecimalHours", () => {
  it("nunca muestra horas decimales: 1.50 cargado es 1h 50min, no 1.83hs", () => {
    // 1h 50min = 1.8333... horas decimales
    expect(formatDecimalHours(1 + 50 / 60)).toBe("1h 50min");
  });

  it("cubre los casos redondos", () => {
    expect(formatDecimalHours(1.5)).toBe("1h 30min");
    expect(formatDecimalHours(2)).toBe("2h");
    expect(formatDecimalHours(0.25)).toBe("15min");
    expect(formatDecimalHours(0)).toBe("0min");
  });

  it("no produce '1h 60min' por redondeo", () => {
    expect(formatDecimalHours(1.999)).toBe("2h");
  });
});
