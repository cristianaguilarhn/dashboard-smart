const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'jwt',
  'secret',
  'SOL_APP_PASSWORD',
]);

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitize(item),
    ])
  );
}

export function auditEvent(eventName, payload = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    eventName,
    payload: sanitize(payload),
  };

  console.info(`[audit] ${JSON.stringify(entry)}`);
}
