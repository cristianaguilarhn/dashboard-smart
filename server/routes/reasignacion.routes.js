import { Router } from 'express';
import { createMockSession } from '../services/solAuth.service.js';
import {
  getStatus,
  reasignarTramites,
} from '../services/solReasignacion.service.js';
import { auditEvent } from '../utils/auditLogger.js';

const router = Router();

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

router.get('/status', (_req, res) => {
  res.json(getStatus());
});

router.post('/login', (req, res, next) => {
  try {
    const { usuario, password } = req.body || {};

    if (!usuario) throw badRequest('usuario requerido.');
    if (!password) throw badRequest('password requerido.');

    const session = createMockSession(usuario);
    auditEvent('reasignacion.login.safe', { usuario });

    res.json({
      ok: true,
      message: 'Autorizacion simulada. Falta conectar autenticacion real con SOL.',
      token: session.token,
      expiresInMinutes: session.expiresInMinutes,
      mode: 'simulation',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reasignar-tramites', async (req, res, next) => {
  const payload = req.body || {};

  try {
    const resultado = await reasignarTramites(payload);

    auditEvent('reasignacion.tramites.intento', {
      fechaHora: new Date().toISOString(),
      codigos: payload.codigos,
      responsableDestino: payload.responsable,
      nota: payload.nota,
      resultado: resultado.ok ? 'ok' : 'error',
      modo: resultado.simulation ? 'simulacion' : 'real',
    });

    res.json(resultado);
  } catch (error) {
    auditEvent('reasignacion.tramites.intento', {
      fechaHora: new Date().toISOString(),
      codigos: payload.codigos,
      responsableDestino: payload.responsable,
      nota: payload.nota,
      resultado: 'error',
      modo: process.env.SOL_INTEGRATION_ENABLED === 'true' ? 'real' : 'simulacion',
      error: error.message,
    });
    next(error);
  }
});

export default router;
