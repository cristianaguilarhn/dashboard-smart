export type ReasignacionTramitePayload = {
  idTramite: string;
  expediente: string;
  tramite: string;
  responsableActual?: string;
  nuevoResponsable: string;
  motivo: string;
  comentario?: string;
};

export type ReasignacionMasivaPayload = {
  tramites: Array<{
    idTramite: string;
    expediente: string;
    tramite: string;
    responsableActual?: string;
  }>;
  nuevoResponsable: string;
  motivo: string;
  comentario?: string;
};

export type ReasignacionResultado = {
  ok: boolean;
  ejecutadoEnSol: boolean;
  mensaje: string;
  resultadosParciales?: Array<{
    idTramite: string;
    expediente: string;
    ok: boolean;
    mensaje?: string;
  }>;
};

const MENSAJE_BACKEND_PENDIENTE =
  'No se puede completar la reasignación: falta configurar VITE_DASHBOARD_API_URL con la URL del backend Node seguro.';

function obtenerDashboardApiUrl() {
  return import.meta.env.VITE_DASHBOARD_API_URL?.trim().replace(/\/$/, '');
}

async function enviarPost<TPayload>(
  ruta: string,
  payload: TPayload
): Promise<ReasignacionResultado> {
  const baseUrl = obtenerDashboardApiUrl();

  if (!baseUrl) {
    return {
      ok: false,
      ejecutadoEnSol: false,
      mensaje: MENSAJE_BACKEND_PENDIENTE,
    };
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${ruta}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      ejecutadoEnSol: false,
      mensaje:
        error instanceof Error
          ? `No se pudo contactar el backend Node seguro. ${error.message}`
          : 'No se pudo contactar el backend Node seguro.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      ejecutadoEnSol: false,
      mensaje: `No se pudo completar la redistribucion. Status HTTP ${response.status}.`,
    };
  }

  const data = (await response.json().catch(() => ({}))) as Partial<ReasignacionResultado>;

  return {
    ok: data.ok ?? true,
    ejecutadoEnSol: data.ejecutadoEnSol ?? true,
    mensaje:
      data.mensaje ??
      ('message' in data ? String(data.message) : undefined) ??
      'Redistribucion procesada por el backend seguro.',
    resultadosParciales: data.resultadosParciales,
  };
}

export async function reasignarTramite(
  payload: ReasignacionTramitePayload
): Promise<ReasignacionResultado> {
  return enviarPost('/api/reasignacion/tramite', payload);
}

export async function reasignarTramitesMasivo(
  payload: ReasignacionMasivaPayload
): Promise<ReasignacionResultado> {
  return enviarPost('/api/reasignacion/tramites', payload);
}

// Estructura esperada para bitacora futura en backend seguro:
// fechaHora, usuarioEjecutor, expediente, responsableAnterior,
// nuevoResponsable, motivo, comentario y resultado devuelto por SOL.
