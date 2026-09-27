export type FilamentType = "PLA" | "PETG" | "ABS" | "TPU" | "Resina" | "Otro";

export interface Category {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  // Los productos guardados antes de que existieran las categorías no lo
  // tienen: undefined significa "Sin categoría", no un dato faltante.
  categoryId?: string;
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

/** Lo que se manda a Firestore al crear/editar: params + metadatos del producto. */
export type ProductInput = CalculationParams & {
  name: string;
  description?: string;
  categoryId?: string;
};

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

// Snapmaker U1 a ~16 h/día: la impresora ($2.500.000) + ~$300.000 de repuestos
// se amortizan en 1 año (5760 h) — igual que la máquina de la cotización web.
export const DEFAULT_SETTINGS: UserSettings = {
  electricityPrice: 150,
  printerWatts: 200,
  profitPercentage: 30,
  vidaUtilHoras: 5760,
  precioRepuestos: 2800000,
  margenErrorPct: 10,
  packaging: 2300,
  laborCostPerHour: 0,
  postProcessMinutes: 0,
};
