import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ApiError } from "./http";

// Mismo Upstash que la web (UPSTASH_REDIS_REST_URL/TOKEN), con prefijo propio.
// Fail-open como en la web: si Redis no responde en 300 ms se deja pasar — un
// Upstash caído no puede tumbar el cotizador.

const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = hasUpstash ? Redis.fromEnv() : null;
const TIMEOUT_MS = 300;

function make(prefix: string, limit: number, window: `${number} ${"s" | "m" | "h"}`) {
  const rl = redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window), prefix: `impricost:${prefix}` })
    : null;

  return async (key: string): Promise<void> => {
    if (!rl) return;
    try {
      const res = await Promise.race([
        rl.limit(key),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
      ]);
      if (res && !res.success) {
        throw new ApiError("rate_limited", "Hiciste muchos pedidos seguidos. Esperá un momento y probá de nuevo.");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.warn("[ratelimit] Upstash no respondió, se deja pasar:", (err as Error).message);
    }
  };
}

/** POST /quotes: 60 por minuto por IP (la web recotiza con debounce al cambiar opciones). */
export const quotesLimit = make("quotes", 60, "60 s");
/** POST /quotes/:id/request: 5 por hora por IP. */
export const requestLimit = make("request", 5, "1 h");
