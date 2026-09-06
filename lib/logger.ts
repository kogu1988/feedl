import "server-only";

// Sprint 63w (B1) — yapısal log. Gözlemlenebilirlik: şu an sadece `console.error`
// vardı; bu, seviyeli + JSON satırlı log üretir (stack/context taşır) ve
// LOG_LEVEL env'iyle filtrelenir. Sentry gibi bir APM'e (Faz 1) köprü kurar.
// Kullanım: `log.error("analiz başarısız", { where: "insights", err })`

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LEVEL_ORDER[raw] ?? LEVEL_ORDER.info;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < threshold()) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };
  const line = JSON.stringify(entry);
  // error → stderr, diğerleri → stdout (log toplamada ayrım).
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
