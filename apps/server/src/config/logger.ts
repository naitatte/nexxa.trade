import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

type LogEntry = {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: LogContext;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLogLevel(): number {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel];
  }
  return env.NODE_ENV === "production" ? LOG_LEVELS.info : LOG_LEVELS.debug;
}

function formatEntry(entry: LogEntry): string {
  if (env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}:`;
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
  return `${prefix} ${entry.message}${contextStr}`;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const minLevel = getMinLogLevel();
  if (LOG_LEVELS[level] < minLevel) {
    return;
  }
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
  const output = formatEntry(entry);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext): void => log("debug", message, context),
  info: (message: string, context?: LogContext): void => log("info", message, context),
  warn: (message: string, context?: LogContext): void => log("warn", message, context),
  error: (message: string, context?: LogContext): void => log("error", message, context),
};
