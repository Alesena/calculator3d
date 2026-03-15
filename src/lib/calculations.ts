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

  // 5. Costo base
  const costoBase = costoMaterial + costoElectricidad + costoRepuestos + costoPackaging;

  // 6. Margen de error
  const costoConError = costoBase * (1 + margenErrorPct / 100);

  // 7A. Precio con markup sobre costo
  const precioConMarkup = costoConError * (1 + profitPercentage / 100) + shippingCost;

  // 7B. Precio con margen real (ganancia como % del precio de venta)
  const precioConMargenReal =
    profitPercentage < 100
      ? costoConError / (1 - profitPercentage / 100) + shippingCost
      : 0;

  // 8. Ganancias
  const gananciaMarkup = precioConMarkup - costoConError - shippingCost;
  const gananciaMargenReal = precioConMargenReal - costoConError - shippingCost;

  return {
    gramosTotales,
    horasTotales,
    costoMaterial,
    costoElectricidad,
    costoRepuestos,
    costoPackaging,
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
