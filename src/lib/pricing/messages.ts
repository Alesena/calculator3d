import type { StoredQuote } from "./public";

// Mensajes de WhatsApp que el admin copia desde el dashboard (spec A8). Puros.

export const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

/** Link de seguimiento en la web (paso 9). */
export function trackingUrl(q: Pick<StoredQuote, "id" | "public_token">, base: string): string {
  return `${base.replace(/\/$/, "")}?q=${encodeURIComponent(q.id)}&t=${encodeURIComponent(q.public_token)}`;
}

export function confirmationMessage(q: StoredQuote, base: string): string {
  const name = q.customer?.name.split(" ")[0] ?? "";
  const hello = `¡Hola${name ? ` ${name}` : ""}! Revisamos tu pieza (${q.input.file_name || q.id}).`;
  const link = trackingUrl(q, base);

  if (q.status === "needs_acceptance" && q.final_total !== null) {
    return [
      hello,
      `El precio final es ${fmtPesos(q.final_total)}${q.reason ? ` porque ${q.reason.charAt(0).toLowerCase()}${q.reason.slice(1)}` : ""}.`,
      `Supera el máximo de ${fmtPesos(q.max_guaranteed)} que te habíamos garantizado, así que necesitamos tu OK.`,
      `Podés aceptarlo o cancelar sin costo acá: ${link}`,
    ].join("\n");
  }

  const total = q.charged_total ?? q.final_total ?? q.estimated_total;
  return [
    hello,
    `Precio final: ${fmtPesos(total)}.${total < q.estimated_total ? " ¡Te salió más barato que el estimado!" : ""}`,
    `Pagá acá: ${q.payment_url ?? "<link de pago>"}`,
    "El link vence en 48 h y el plazo de producción corre desde el pago.",
    `Seguimiento: ${link}`,
  ].join("\n");
}

/** wa.me al cliente con el mensaje precargado. */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
