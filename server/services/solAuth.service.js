import crypto from 'node:crypto';

export function createMockSession(usuario) {
  const expiresInMinutes = Number(process.env.SESSION_TTL_MINUTES || 30);

  return {
    usuario,
    token: `mock-token-${crypto.randomUUID()}`,
    expiresInMinutes,
    mode: 'safe',
  };
}
