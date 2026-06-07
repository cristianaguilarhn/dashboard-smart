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
  'Funcionalidad preparada. La reasignacion aun no se ejecuta en SOL porque falta conectar el backend seguro.';

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
      ok: true,
      ejecutadoEnSol: false,
      mensaje: MENSAJE_BACKEND_PENDIENTE,
    };
  }

  const response = await fetch(`${baseUrl}${ruta}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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
