const DEFAULTS = {
  descripcion: "Canasta",
  cantidad: 1,
  horas: 6.1,
  gramos: 146,
  precioKgFilamento: 22500,
  precioKWh: 45,
  consumoWatts: 200,
  vidaUtilHoras: 4320,
  precioRepuestos: 15000,
  packaging: 2300,
  margenErrorPct: 10,
  margenGananciaPct: 30.1,
  moneda: "ARS"
};

function calcularPrecio({
  precioKgFilamento,
  precioKWh,
  consumoWatts,
  vidaUtilHoras,
  precioRepuestos,
  packaging,
  margenErrorPct,
  margenGananciaPct,
  gramos,
  horas,
  cantidad
}) {
  const cantidadFinal = cantidad > 0 ? cantidad : 1;

  // Totales de lote
  const gramosTotales = gramos * cantidadFinal;
  const horasTotales = horas * cantidadFinal;

  // 1. Material
  const precioPorGramo = precioKgFilamento / 1000;
  const costoMaterial = gramosTotales * precioPorGramo;

  // 2. Electricidad
  const consumoKW = consumoWatts / 1000;
  const consumoKWhTotal = consumoKW * horasTotales;
  const costoElectricidad = consumoKWhTotal * precioKWh;

  // 3. Repuestos / mantenimiento proporcional
  const costoRepuestosPorHora = precioRepuestos / vidaUtilHoras;
  const costoRepuestos = costoRepuestosPorHora * horasTotales;

  // 4. Packaging
  const costoPackaging = packaging * cantidadFinal;

  // 5. Costo base
  const costoBase = costoMaterial + costoElectricidad + costoRepuestos + costoPackaging;

  // 6. Aplicar margen de error
  const costoConError = costoBase * (1 + margenErrorPct / 100);

  // 7A. Precio final con recargo sobre costo
  const precioConMarkup = costoConError * (1 + margenGananciaPct / 100);

  // 7B. Precio final con margen real
  let precioConMargenReal = 0;
  if (margenGananciaPct < 100) {
    precioConMargenReal = costoConError / (1 - margenGananciaPct / 100);
  }

  // 8. Ganancias
  const gananciaMarkup = precioConMarkup - costoConError;
  const gananciaMargenReal = precioConMargenReal - costoConError;

  return {
    gramosTotales,
    horasTotales,
    costoMaterial,
    costoElectricidad,
    costoRepuestos,
    costoPackaging,
    costoBase,
    costoConError,
    costoTotalProduccion: costoConError,
    precioConMarkup,
    precioConMargenReal,
    gananciaMarkup,
    gananciaMargenReal,
    precioUnidadMarkup: precioConMarkup / cantidadFinal,
    precioUnidadMargenReal: precioConMargenReal / cantidadFinal
  };
}

function formatearMoneda(valor, moneda = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
}

function parseNumberOrDefault(value, defaultValue) {
  if (value === "" || value === null || value === undefined) {
    return defaultValue;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function getFormData() {
  return {
    descripcion: getInputValue("descripcion") || DEFAULTS.descripcion,
    cantidad: parseNumberOrDefault(getInputValue("cantidad"), DEFAULTS.cantidad),
    horas: parseNumberOrDefault(getInputValue("horas"), DEFAULTS.horas),
    gramos: parseNumberOrDefault(getInputValue("gramos"), DEFAULTS.gramos),
    precioKgFilamento: parseNumberOrDefault(
      getInputValue("precioKgFilamento"),
      DEFAULTS.precioKgFilamento
    ),
    precioKWh: parseNumberOrDefault(getInputValue("precioKWh"), DEFAULTS.precioKWh),
    consumoWatts: parseNumberOrDefault(getInputValue("consumoWatts"), DEFAULTS.consumoWatts),
    vidaUtilHoras: parseNumberOrDefault(getInputValue("vidaUtilHoras"), DEFAULTS.vidaUtilHoras),
    precioRepuestos: parseNumberOrDefault(getInputValue("precioRepuestos"), DEFAULTS.precioRepuestos),
    packaging: parseNumberOrDefault(getInputValue("packaging"), DEFAULTS.packaging),
    margenErrorPct: parseNumberOrDefault(getInputValue("margenErrorPct"), DEFAULTS.margenErrorPct),
    margenGananciaPct: parseNumberOrDefault(
      getInputValue("margenGananciaPct"),
      DEFAULTS.margenGananciaPct
    ),
    moneda: document.getElementById("moneda").value || DEFAULTS.moneda
  };
}

function renderResultados(data, result) {
  const moneda = data.moneda;

  document.getElementById("precioMarkup").textContent = formatearMoneda(result.precioConMarkup, moneda);
  document.getElementById("precioMargenReal").textContent = formatearMoneda(result.precioConMargenReal, moneda);

  document.getElementById("gananciaMarkup").textContent = formatearMoneda(result.gananciaMarkup, moneda);
  document.getElementById("gananciaMargenReal").textContent = formatearMoneda(result.gananciaMargenReal, moneda);

  document.getElementById("costoMaterial").textContent = formatearMoneda(result.costoMaterial, moneda);
  document.getElementById("costoElectricidad").textContent = formatearMoneda(result.costoElectricidad, moneda);
  document.getElementById("costoRepuestos").textContent = formatearMoneda(result.costoRepuestos, moneda);
  document.getElementById("costoPackaging").textContent = formatearMoneda(result.costoPackaging, moneda);
  document.getElementById("costoBase").textContent = formatearMoneda(result.costoBase, moneda);
  document.getElementById("costoConError").textContent = formatearMoneda(result.costoConError, moneda);
  document.getElementById("costoTotalProduccion").textContent = formatearMoneda(result.costoTotalProduccion, moneda);
  document.getElementById("precioUnidadMarkup").textContent = formatearMoneda(result.precioUnidadMarkup, moneda);
  document.getElementById("precioUnidadMargenReal").textContent = formatearMoneda(
    result.precioUnidadMargenReal,
    moneda
  );

  document.getElementById("horasTotales").textContent = `${result.horasTotales.toFixed(2)} hs`;
  document.getElementById("gramosTotales").textContent = `${result.gramosTotales.toFixed(2)} g`;
}

function cargarDefaultsEnInputs() {
  document.getElementById("descripcion").value = DEFAULTS.descripcion;
  document.getElementById("cantidad").value = DEFAULTS.cantidad;
  document.getElementById("horas").value = DEFAULTS.horas;
  document.getElementById("gramos").value = DEFAULTS.gramos;
  document.getElementById("precioKgFilamento").value = DEFAULTS.precioKgFilamento;
  document.getElementById("precioKWh").value = DEFAULTS.precioKWh;
  document.getElementById("consumoWatts").value = DEFAULTS.consumoWatts;
  document.getElementById("vidaUtilHoras").value = DEFAULTS.vidaUtilHoras;
  document.getElementById("precioRepuestos").value = DEFAULTS.precioRepuestos;
  document.getElementById("packaging").value = DEFAULTS.packaging;
  document.getElementById("margenErrorPct").value = DEFAULTS.margenErrorPct;
  document.getElementById("margenGananciaPct").value = DEFAULTS.margenGananciaPct;
  document.getElementById("moneda").value = DEFAULTS.moneda;
}

function limpiarFormulario() {
  document.getElementById("calculatorForm").reset();
  calcularYMostrar();
}

function calcularYMostrar() {
  const data = getFormData();

  const result = calcularPrecio({
    precioKgFilamento: data.precioKgFilamento,
    precioKWh: data.precioKWh,
    consumoWatts: data.consumoWatts,
    vidaUtilHoras: data.vidaUtilHoras,
    precioRepuestos: data.precioRepuestos,
    packaging: data.packaging,
    margenErrorPct: data.margenErrorPct,
    margenGananciaPct: data.margenGananciaPct,
    gramos: data.gramos,
    horas: data.horas,
    cantidad: data.cantidad
  });

  renderResultados(data, result);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calculatorForm");
  const btnCargarDefaults = document.getElementById("btnCargarDefaults");
  const btnLimpiar = document.getElementById("btnLimpiar");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calcularYMostrar();
  });

  btnCargarDefaults.addEventListener("click", () => {
    cargarDefaultsEnInputs();
    calcularYMostrar();
  });

  btnLimpiar.addEventListener("click", () => {
    limpiarFormulario();
  });

  calcularYMostrar();
});