import { CalculatedPrices } from "@/types";
import { formatARS } from "@/lib/calculations";

interface Props {
  prices: CalculatedPrices;
  cantidad?: number;
  filamentWeight?: number;
  filamentType?: string;
  profitPercentage?: number;
  margenErrorPct?: number;
}

export function PriceBreakdown({
  prices,
  cantidad = 1,
  filamentWeight,
  filamentType,
  profitPercentage = 0,
  margenErrorPct = 0,
}: Props) {
  const showPerUnit = cantidad > 1;

  return (
    <div className="space-y-1 text-sm">
      {/* Totales del lote */}
      {showPerUnit && (
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 py-1 border-b border-dashed border-gray-200 dark:border-gray-700 mb-2">
          <span>Lote: {cantidad} unidades</span>
          <span>{prices.gramosTotales.toFixed(1)}g · {prices.horasTotales.toFixed(2)}hs total</span>
        </div>
      )}

      {/* Costos */}
      <Row
        label={`Material${filamentWeight ? ` (${prices.gramosTotales.toFixed(1)}g ${filamentType})` : ""}`}
        value={formatARS(prices.costoMaterial)}
      />
      <Row
        label={`Electricidad (${prices.horasTotales.toFixed(2)}hs)`}
        value={formatARS(prices.costoElectricidad)}
      />
      <Row label="Repuestos/mantenimiento" value={formatARS(prices.costoRepuestos)} />
      <Row label={`Packaging (×${cantidad})`} value={formatARS(prices.costoPackaging)} />

      <div className="flex justify-between py-2 font-semibold border-t border-gray-200 dark:border-gray-700 mt-1">
        <span className="text-gray-700 dark:text-gray-300">Costo base</span>
        <span className="text-gray-900 dark:text-white">{formatARS(prices.costoBase)}</span>
      </div>

      <Row
        label={`Margen de error (${margenErrorPct}%)`}
        value={formatARS(prices.costoConError - prices.costoBase)}
        highlight="amber"
      />

      <div className="flex justify-between py-2 font-semibold border-t border-gray-200 dark:border-gray-700">
        <span className="text-gray-700 dark:text-gray-300">Costo total producción</span>
        <span className="text-gray-900 dark:text-white">{formatARS(prices.costoConError)}</span>
      </div>

      {prices.shipping > 0 && (
        <Row label="Envío" value={formatARS(prices.shipping)} />
      )}

      {/* Dos precios finales */}
      <div className="mt-3 space-y-2">
        <PriceCard
          label={`Precio con markup (${profitPercentage}% sobre costo)`}
          sublabel={`Ganancia: ${formatARS(prices.gananciaMarkup)}`}
          price={formatARS(prices.precioConMarkup)}
          perUnit={showPerUnit ? formatARS(prices.precioUnidadMarkup) : null}
          color="orange"
        />
        {prices.precioConMargenReal > 0 && (
          <PriceCard
            label={`Precio con margen real (${profitPercentage}% del precio final)`}
            sublabel={`Ganancia: ${formatARS(prices.gananciaMargenReal)}`}
            price={formatARS(prices.precioConMargenReal)}
            perUnit={showPerUnit ? formatARS(prices.precioUnidadMargenReal) : null}
            color="blue"
          />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "amber";
}) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/60">
      <span className={highlight === "amber" ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}>
        {label}
      </span>
      <span className={`font-medium ${highlight === "amber" ? "text-amber-700 dark:text-amber-300" : "text-gray-800 dark:text-gray-200"}`}>
        {value}
      </span>
    </div>
  );
}

function PriceCard({
  label,
  sublabel,
  price,
  perUnit,
  color,
}: {
  label: string;
  sublabel: string;
  price: string;
  perUnit: string | null;
  color: "orange" | "blue";
}) {
  const colors = {
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400",
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-black">{price}</p>
          {perUnit && (
            <p className="text-xs opacity-70 mt-0.5">{perUnit} / unidad</p>
          )}
        </div>
        <p className="text-xs opacity-70 text-right">{sublabel}</p>
      </div>
    </div>
  );
}
