import { Router } from 'express';
import { createMockSession } from '../services/solAuth.service.js';
import {
  getStatus,
  validarReasignacionIndividual,
  validarReasignacionMasiva,
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
      mode: 'safe',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/tramite', (req, res, next) => {
  try {
    const payload = req.body || {};
    const resultado = validarReasignacionIndividual(payload);

    auditEvent('reasignacion.tramite.validada', {
      expediente: payload.expediente,
      responsableActual: payload.responsableActual,
      nuevoResponsable: payload.nuevoResponsable,
      mode: 'safe',
    });

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

router.post('/tramites', (req, res, next) => {
  try {
    const payload = req.body || {};
    const resultado = validarReasignacionMasiva(payload);

    auditEvent('reasignacion.tramites.validada', {
      total: Array.isArray(payload.tramites) ? payload.tramites.length : 0,
      nuevoResponsable: payload.nuevoResponsable,
      mode: 'safe',
    });

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
