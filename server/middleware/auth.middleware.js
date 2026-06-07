export function optionalMockAuth(req, _res, next) {
  const authorization = req.headers.authorization || '';

  req.safeSession = {
    authenticated: authorization.startsWith('Bearer mock-token-'),
    mode: 'safe',
  };

  next();
}
