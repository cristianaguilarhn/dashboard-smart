const SIMULATION_MESSAGE =
  'Reasignacion simulada. Falta activar integracion real con SOL.';

function solIntegrationEnabled() {
  return process.env.SOL_INTEGRATION_ENABLED === 'true';
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function integrationError(message) {
  const error = new Error(message);
  error.statusCode = 502;
  return error;
}

function toNumber(value, field) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw badRequest(`${field} debe ser numerico.`);
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw badRequest(`${field} debe ser numerico.`);
  }
  return numberValue;
}

export function getStatus() {
  return {
    ok: true,
    service: 'reasignacion',
    solIntegrationEnabled: solIntegrationEnabled(),
    mode: solIntegrationEnabled() ? 'real' : 'simulation',
  };
}

export function validateReasignacionTramites(payload) {
  if (!Array.isArray(payload?.codigos) || payload.codigos.length === 0) {
    throw badRequest('codigos debe ser un arreglo con al menos un elemento.');
  }

  const codigos = payload.codigos.map((codigo, index) =>
    toNumber(codigo, `codigos[${index}]`)
  );
  const responsable = toNumber(payload.responsable, 'responsable');
  const nota = String(payload.nota || '').trim();

  if (!nota) {
    throw badRequest('nota obligatoria.');
  }

  return {
    codigos,
    responsable,
    nota,
  };
}

export async function reasignarTramites(payload) {
  const data = validateReasignacionTramites(payload);

  if (!solIntegrationEnabled()) {
    return {
      ok: true,
      simulation: true,
      simulacion: true,
      ejecutadoEnSol: false,
      message: SIMULATION_MESSAGE,
      mensaje: SIMULATION_MESSAGE,
      codigos: data.codigos,
      responsable: data.responsable,
    };
  }

  return callSolCambiarResponsables(data);
}

async function callSolCambiarResponsables(data) {
  const baseUrl = String(process.env.SOL_API_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    throw integrationError('SOL_API_BASE_URL no esta configurado.');
  }

  const url = new URL(`${baseUrl}/api/Listas/CambiarResponsables`);
  data.codigos.forEach((codigo) => {
    url.searchParams.append('Codigos', String(codigo));
  });
  url.searchParams.set('Responsable', String(data.responsable));
  url.searchParams.set('Nota', data.nota);

  const response = await fetch(url, {
    method: 'POST',
    headers: buildSolHeaders(),
  });

  const responseText = await response.text();
  const responseBody = parseJsonOrText(responseText);

  if (!response.ok) {
    throw integrationError(
      `SOL respondio con status ${response.status} al cambiar responsables.`
    );
  }

  return {
    ok: true,
    simulation: false,
    simulacion: false,
    ejecutadoEnSol: true,
    message: 'Reasignacion enviada a SOL.',
    mensaje: 'Reasignacion enviada a SOL.',
    codigos: data.codigos,
    responsable: data.responsable,
    solStatus: response.status,
    solResponse: responseBody,
  };
}

function buildSolHeaders() {
  const headers = {};
  const token = String(process.env.SOL_TOKEN || '').trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function parseJsonOrText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
