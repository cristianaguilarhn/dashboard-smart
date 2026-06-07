function safeModeEnabled() {
  return process.env.ENABLE_SOL_REAL_WRITE !== 'true';
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function requireField(payload, field) {
  if (!payload?.[field]) {
    throw badRequest(`${field} requerido.`);
  }
}

export function getStatus() {
  return {
    ok: true,
    service: 'reasignacion',
    mode: safeModeEnabled() ? 'safe' : 'real-write-not-implemented',
    solWriteEnabled: !safeModeEnabled(),
  };
}

export function validarReasignacionIndividual(payload) {
  requireField(payload, 'idTramite');
  requireField(payload, 'expediente');
  requireField(payload, 'nuevoResponsable');
  requireField(payload, 'motivo');

  if (
    payload.responsableActual &&
    payload.nuevoResponsable === payload.responsableActual
  ) {
    throw badRequest('nuevoResponsable no puede ser igual a responsableActual.');
  }

  if (!safeModeEnabled()) {
    return {
      ok: false,
      mode: 'real-write-not-implemented',
      message: 'La escritura real hacia SOL aun no esta implementada.',
    };
  }

  return {
    ok: true,
    mode: 'safe',
    message:
      'Solicitud validada. No se ejecuto cambio real en SOL porque ENABLE_SOL_REAL_WRITE=false.',
    data: sanitizeIndividualPayload(payload),
  };
}

export function validarReasignacionMasiva(payload) {
  if (!Array.isArray(payload.tramites) || payload.tramites.length === 0) {
    throw badRequest('tramites debe ser un arreglo no vacio.');
  }
  requireField(payload, 'nuevoResponsable');
  requireField(payload, 'motivo');

  payload.tramites.forEach((tramite, index) => {
    requireField(tramite, 'idTramite');
    requireField(tramite, 'expediente');
    if (!tramite.tramite) {
      throw badRequest(`tramites[${index}].tramite requerido.`);
    }
  });

  const responsables = Array.from(
    new Set(payload.tramites.map((tramite) => tramite.responsableActual).filter(Boolean))
  );

  if (responsables.length === 1 && responsables[0] === payload.nuevoResponsable) {
    throw badRequest(
      'nuevoResponsable no puede ser igual al responsableActual comun de los tramites.'
    );
  }

  if (!safeModeEnabled()) {
    return {
      ok: false,
      mode: 'real-write-not-implemented',
      message: 'La escritura real hacia SOL aun no esta implementada.',
    };
  }

  return {
    ok: true,
    mode: 'safe',
    message:
      'Solicitud masiva validada. No se ejecutaron cambios reales en SOL porque ENABLE_SOL_REAL_WRITE=false.',
    total: payload.tramites.length,
    data: {
      tramites: payload.tramites.map(sanitizeTramiteMasivo),
      nuevoResponsable: payload.nuevoResponsable,
      motivo: payload.motivo,
      comentario: payload.comentario || '',
    },
  };
}

function sanitizeIndividualPayload(payload) {
  return {
    idTramite: payload.idTramite,
    expediente: payload.expediente,
    tramite: payload.tramite || '',
    responsableActual: payload.responsableActual || '',
    nuevoResponsable: payload.nuevoResponsable,
    motivo: payload.motivo,
    comentario: payload.comentario || '',
  };
}

function sanitizeTramiteMasivo(tramite) {
  return {
    idTramite: tramite.idTramite,
    expediente: tramite.expediente,
    tramite: tramite.tramite,
    responsableActual: tramite.responsableActual || '',
  };
}
