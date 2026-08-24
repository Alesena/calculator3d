export type FilamentType = "PLA" | "PETG" | "ABS" | "TPU" | "Resina" | "Otro";

export interface CalculationParams {
  cantidad: number;
  printTimeHours: number;
  printTimeMinutes: number;
  filamentWeight: number; // gramos enteros por unidad, incluye soportes y purga
  filamentType: FilamentType;
  filamentTypeCustom?: string;
  filamentPricePerKg: number;
  printerWatts: number;
  electricityPrice: number; // precio por kWh
  vidaUtilHoras: number;   // vida útil impresora en horas
  precioRepuestos: number; // costo total de repuestos/mantenimiento
  packaging: number;       // packaging por unidad
  laborCostPerHour: number;   // costo de tu hora de trabajo
  postProcessMinutes: number; // minutos de post-proceso por unidad
  margenErrorPct: number;  // margen de error %
  profitPercentage: number; // margen de ganancia %
  shippingCost: number;
}

export interface CalculatedPrices {
  gramosTotales: number;
  horasTotales: number;
  horasManoObra: number;
  costoMaterial: number;
  costoElectricidad: number;
  costoRepuestos: number;
  costoPackaging: number;
  costoManoObra: number;
  costoBase: number;
  costoConError: number;
  precioConMarkup: number;
  precioConMargenReal: number;
  gananciaMarkup: number;
  gananciaMargenReal: number;
  precioUnidadMarkup: number;
  precioUnidadMargenReal: number;
  shipping: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  // Params
  cantidad: number;
  printTimeHours: number;
  printTimeMinutes: number;
  filamentWeight: number;
  filamentType: FilamentType;
  filamentTypeCustom?: string;
  filamentPricePerKg: number;
  printerWatts: number;
  electricityPrice: number;
  vidaUtilHoras: number;
  precioRepuestos: number;
  packaging: number;
  laborCostPerHour: number;
  postProcessMinutes: number;
  margenErrorPct: number;
  profitPercentage: number;
  shippingCost: number;
  // Results
  calculatedPrices: CalculatedPrices;
  // Filters
  month: number;
  year: number;
}

export interface UserSettings {
  electricityPrice: number;
  printerWatts: number;
  profitPercentage: number;
  vidaUtilHoras: number;
  precioRepuestos: number;
  margenErrorPct: number;
  packaging: number;
  laborCostPerHour: number;
  postProcessMinutes: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  electricityPrice: 45,
  printerWatts: 200,
  profitPercentage: 30,
  vidaUtilHoras: 4320,
  precioRepuestos: 15000,
  margenErrorPct: 10,
  packaging: 2300,
  laborCostPerHour: 0,
  postProcessMinutes: 0,
};
