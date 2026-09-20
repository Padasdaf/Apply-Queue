const REDACTED_KEY = /authorization|cookie|password|secret|token|api[-_]?key/i;
const MAX_STRING_LENGTH = 2_000;
const MAX_DEPTH = 5;

export type SerializedError = {
  name: string;
  message: string;
  category: "RPC" | "PAGE_EVALUATE" | "EXECUTION_CONTEXT" | "LOCATOR" | "PAGE_CLOSED" | "TIMEOUT" | "PROTOCOL" | "UNKNOWN";
  stack?: string;
  code?: string | number;
  data?: unknown;
  cause?: unknown;
  step?: string;
};

export class PostNavigationStepError extends Error {
  readonly step: string;

  constructor(step: string, cause: unknown) {
    const causeMessage = getErrorMessage(cause);
    super(`Post-navigation step ${step} failed: ${causeMessage}`, { cause });
    this.name = "PostNavigationStepError";
    this.step = step;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return typeof error === "string" ? error : "Unknown worker error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return undefined;
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (!isRecord(value) && !Array.isArray(value)) return String(value);
  if (depth >= MAX_DEPTH) return "[max depth]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (value instanceof Error) {
    const source = value as Error & { code?: unknown; data?: unknown };
    return {
      name: source.name,
      message: source.message,
      stack: source.stack?.slice(0, 8_000),
      ...(typeof source.code === "string" || typeof source.code === "number" ? { code: source.code } : {}),
      ...(source.data !== undefined ? { data: sanitizeValue(source.data, depth + 1, seen) } : {}),
      ...(source.cause !== undefined ? { cause: sanitizeValue(source.cause, depth + 1, seen) } : {}),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1, seen));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = REDACTED_KEY.test(key) ? "[redacted]" : sanitizeValue(item, depth + 1, seen);
  }
  return sanitized;
}

export function serializeError(error: unknown): SerializedError {
  const source = isRecord(error) ? error : {};
  const serialized: SerializedError = {
    name: error instanceof Error ? error.name : typeof source.name === "string" ? source.name : "Error",
    message: getErrorMessage(error),
    category: "UNKNOWN",
  };
  const stack = error instanceof Error ? error.stack : source.stack;
  if (typeof stack === "string") serialized.stack = stack.slice(0, 8_000);
  if (typeof source.code === "string" || typeof source.code === "number") serialized.code = source.code;
  if ("data" in source) serialized.data = sanitizeValue(source.data, 0, new WeakSet());
  const cause = error instanceof Error ? error.cause : source.cause;
  if (cause !== undefined) serialized.cause = sanitizeValue(cause, 0, new WeakSet());
  if (error instanceof PostNavigationStepError) serialized.step = error.step;
  // Classify from protocol/error payloads, not stack frames. Function and file
  // names such as a test runner's `runWithTimeout` are not failure evidence.
  const diagnosticText = JSON.stringify({
    name: serialized.name,
    message: serialized.message,
    code: serialized.code,
    data: serialized.data,
    cause: serialized.cause,
    step: serialized.step,
  }).toLowerCase();
  if (/execution context was destroyed|cannot find context|context destroyed/.test(diagnosticText)) {
    serialized.category = "EXECUTION_CONTEXT";
  } else if (/target closed|page closed|session closed|detached/.test(diagnosticText)) {
    serialized.category = "PAGE_CLOSED";
  } else if (/protocol error/.test(diagnosticText)) {
    serialized.category = "PROTOCOL";
  } else if (/\"code\":-32603|rpc/.test(diagnosticText)) {
    serialized.category = "RPC";
  } else if (/timeout|timed out/.test(diagnosticText)) {
    serialized.category = "TIMEOUT";
  } else if (/locator/.test(diagnosticText)) {
    serialized.category = "LOCATOR";
  } else if (/form_inspection|evaluate/.test(diagnosticText)) {
    serialized.category = "PAGE_EVALUATE";
  }
  return serialized;
}

function findCauseDetail(value: unknown): { code?: string | number; message?: string } {
  if (!isRecord(value)) return {};
  const ownCode = typeof value.code === "string" || typeof value.code === "number" ? value.code : undefined;
  const ownMessage = typeof value.message === "string" ? value.message : undefined;
  const nested = findCauseDetail(value.cause);
  const code = nested.code ?? ownCode;
  const message = nested.message ?? ownMessage;
  return {
    ...(code !== undefined ? { code } : {}),
    ...(message !== undefined ? { message } : {}),
  };
}

export function formatErrorMessage(error: unknown): string {
  const serialized = serializeError(error);
  const cause = isRecord(serialized.cause) ? serialized.cause : undefined;
  const causeDetail = findCauseDetail(cause);
  const causeCode = causeDetail.code !== undefined ? ` code ${causeDetail.code}` : "";
  const causeMessage = causeDetail.message ?? "";
  const detail = causeMessage && causeMessage !== serialized.message
    ? ` (cause${causeCode}: ${causeMessage})`
    : causeCode ? ` (cause${causeCode})` : "";
  return `${serialized.name}: ${serialized.message}${detail}`.slice(0, 2_000);
}

export function isTransientBrowserReadError(error: unknown): boolean {
  const serialized = serializeError(error);
  const text = JSON.stringify(serialized).toLowerCase();
  return [
    "execution context was destroyed",
    "cannot find context",
    "context destroyed",
    "target closed",
    "page closed",
    "session closed",
    "detached",
    "protocol error",
    "rpc",
    '"code":-32603',
  ].some((signal) => text.includes(signal));
}
