export type ReasignacionTramitesPayload = {
  codigos: number[];
  responsable: number;
  nota: string;
};

export type ReasignacionTramitePayload = {
  codigo: number;
  responsable: number;
  nota: string;
};

export type ReasignacionResultado = {
  ok: boolean;
  ejecutadoEnSol: boolean;
  simulation?: boolean;
  simulacion?: boolean;
  message?: string;
  mensaje: string;
  codigos?: number[];
  responsable?: number;
};

const MENSAJE_BACKEND_NO_CONFIGURADO =
  'No se puede completar la reasignación: falta configurar VITE_DASHBOARD_API_URL con la URL del backend Node seguro.';

function obtenerDashboardApiUrl() {
  return import.meta.env.VITE_DASHBOARD_API_URL?.trim().replace(/\/$/, '');
}

async function enviarReasignacion(
  payload: ReasignacionTramitesPayload
): Promise<ReasignacionResultado> {
  const baseUrl = obtenerDashboardApiUrl();

  if (!baseUrl) {
    return {
      ok: false,
      ejecutadoEnSol: false,
      simulation: false,
      simulacion: false,
      mensaje: MENSAJE_BACKEND_NO_CONFIGURADO,
    };
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/dashboard/reasignar-tramites`, {
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
      simulation: false,
      simulacion: false,
      mensaje:
        error instanceof Error
          ? `No se pudo contactar el backend Node seguro. ${error.message}`
          : 'No se pudo contactar el backend Node seguro.',
    };
  }

  const data = (await response.json().catch(() => ({}))) as Partial<ReasignacionResultado>;

  if (!response.ok) {
    return {
      ok: false,
      ejecutadoEnSol: false,
      simulation: false,
      simulacion: false,
      mensaje:
        data.mensaje ||
        data.message ||
        `No se pudo completar la reasignación. Status HTTP ${response.status}.`,
    };
  }

  return {
    ok: data.ok ?? true,
    ejecutadoEnSol: data.ejecutadoEnSol ?? false,
    simulation: data.simulation,
    simulacion: data.simulacion ?? data.simulation,
    message: data.message,
    mensaje:
      data.mensaje ||
      data.message ||
      'Reasignación procesada por el backend seguro.',
    codigos: data.codigos,
    responsable: data.responsable,
  };
}

export async function reasignarTramite(
  payload: ReasignacionTramitePayload
): Promise<ReasignacionResultado> {
  return enviarReasignacion({
    codigos: [payload.codigo],
    responsable: payload.responsable,
    nota: payload.nota,
  });
}

export async function reasignarTramites(
  payload: ReasignacionTramitesPayload
): Promise<ReasignacionResultado> {
  return enviarReasignacion(payload);
}
