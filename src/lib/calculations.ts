import { CalculationParams, CalculatedPrices } from "@/types";

export function calculatePrice(params: CalculationParams): CalculatedPrices {
  const {
    cantidad,
    printTimeHours,
    printTimeMinutes,
    filamentWeight,
    filamentPricePerKg,
    printerWatts,
    electricityPrice,
    vidaUtilHoras,
    precioRepuestos,
    packaging,
    laborCostPerHour = 0,
    postProcessMinutes = 0,
    margenErrorPct,
    profitPercentage,
    shippingCost = 0,
  } = params;

  const cantidadFinal = cantidad > 0 ? cantidad : 1;
  const horasUnitarias = printTimeHours + printTimeMinutes / 60;

  // Totales del lote
  const gramosTotales = filamentWeight * cantidadFinal;
  const horasTotales = horasUnitarias * cantidadFinal;

  // 1. Material
  const costoMaterial = gramosTotales * (filamentPricePerKg / 1000);

  // 2. Electricidad
  const costoElectricidad = (printerWatts / 1000) * horasTotales * electricityPrice;

  // 3. Repuestos / mantenimiento proporcional
  const costoRepuestos = (precioRepuestos / vidaUtilHoras) * horasTotales;

  // 4. Packaging (por unidad)
  const costoPackaging = packaging * cantidadFinal;

  // 5. Mano de obra: sólo el post-proceso (quitar soportes, lijar, pintar,
  //    embalar). Las horas de impresión no cuentan porque la máquina trabaja
  //    sola — eso ya se cobra vía electricidad y repuestos.
  const horasManoObra = (postProcessMinutes / 60) * cantidadFinal;
  const costoManoObra = horasManoObra * laborCostPerHour;

  // 6. Costo base
  const costoBase =
    costoMaterial + costoElectricidad + costoRepuestos + costoPackaging + costoManoObra;

  // 7. Margen de error
  const costoConError = costoBase * (1 + margenErrorPct / 100);

  // 8A. Precio con markup sobre costo
  const precioConMarkup = costoConError * (1 + profitPercentage / 100) + shippingCost;

  // 8B. Precio con margen real (ganancia como % del precio de venta)
  const precioConMargenReal =
    profitPercentage < 100
      ? costoConError / (1 - profitPercentage / 100) + shippingCost
      : 0;

  // 9. Ganancias
  const gananciaMarkup = precioConMarkup - costoConError - shippingCost;
  const gananciaMargenReal = precioConMargenReal - costoConError - shippingCost;

  return {
    gramosTotales,
    horasTotales,
    horasManoObra,
    costoMaterial,
    costoElectricidad,
    costoRepuestos,
    costoPackaging,
    costoManoObra,
    costoBase,
    costoConError,
    precioConMarkup,
    precioConMargenReal,
    gananciaMarkup,
    gananciaMargenReal,
    precioUnidadMarkup: (precioConMarkup - shippingCost) / cantidadFinal,
    precioUnidadMargenReal: (precioConMargenReal - shippingCost) / cantidadFinal,
    shipping: shippingCost,
  };
}

export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatHours(hours: number, minutes: number): string {
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

/**
 * Horas decimales → "1h 50min". El tiempo se carga como `1.50` (1h 50min), así
 * que mostrar "1.83hs" se lee como si el cálculo estuviera mal. Nunca
 * imprimimos horas decimales.
 */
export function formatDecimalHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  return formatHours(Math.floor(totalMinutes / 60), totalMinutes % 60);
}
