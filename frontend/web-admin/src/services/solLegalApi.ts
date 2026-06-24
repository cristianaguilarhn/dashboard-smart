import { normalizarTramitesFaseLegalDM } from './normalizarDatosLegalSol';
import {
  FuenteDatosLegal,
  RespuestaFaseLegalDM,
  TramiteFaseLegalRaw,
} from '../types/solLegal';

type DataSource = 'api' | 'json' | 'mock';

const ENDPOINT_LEGAL_DM =
  import.meta.env.VITE_SOL_LEGAL_DM_URL || '/api/sol/legal-dm';
const JSON_LOCAL_LEGAL_URL = '/data/api-json/dm-tramites-fase-legal.customization';
const TIMEOUT_MS = 250000;
const DATA_SOURCE = String(import.meta.env.VITE_DATA_SOURCE || 'api').toLowerCase() as DataSource;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

async function fetchConTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function extraerRegistros(valor: unknown): TramiteFaseLegalRaw[] {
  if (Array.isArray(valor)) return valor as TramiteFaseLegalRaw[];

  if (valor && typeof valor === 'object') {
    const objeto = valor as {
      data?: unknown;
      registros?: unknown;
      items?: unknown;
    };

    if (Array.isArray(objeto.data)) return objeto.data as TramiteFaseLegalRaw[];
    if (objeto.data && typeof objeto.data === 'object') {
      return extraerRegistros(objeto.data);
    }
    if (Array.isArray(objeto.registros)) return objeto.registros as TramiteFaseLegalRaw[];
    if (Array.isArray(objeto.items)) return objeto.items as TramiteFaseLegalRaw[];
  }

  return [];
}

function respuestaVacia(params: {
  fuenteDatos: FuenteDatosLegal;
  mensajeError: string;
  urlConsultada?: string;
  statusHttp?: number;
}): RespuestaFaseLegalDM {
  return {
    tramites: [],
    cargaPorOficial: [],
    matrizOficialLegal: [],
    distribucionPorCondicion: [
      { key: 'vencido', label: 'Vencidos', value: 0 },
      { key: 'por_vencer', label: 'Próximos', value: 0 },
      { key: 'en_tiempo', label: 'En plazo', value: 0 },
      { key: 'sin_fecha_probable', label: 'Sin fecha', value: 0 },
    ],
    distribucionPorDiasLegal: [],
    distribucionPorDiasRestantes: [],
    alertasLegal: {
      vencidos: [],
      proximos: [],
      sinFechaProbable: [],
      margenCritico: [],
      mayorDiasLegal: [],
    },
    prioridadOperativaLegal: {
      vencidos: 0,
      proximos: 0,
      margenCritico: 0,
      sinFechaProbable: 0,
      mayorCargaOficial: null,
      mayorCargaTotal: 0,
      mayorDiasEnLegal: null,
    },
    metricas: {
      totalEnLegal: 0,
      oficialesConCarga: 0,
      vencidos: 0,
      proximosAVencer: 0,
      sinFechaProbable: 0,
      margenCriticoDesdeTecnica: 0,
      promedioDiasEnLegal: null,
      mayorCargaLegal: 0,
      tramitesDentroPlazo: 0,
      cargaPonderadaLegal: 0,
      mayorDiasEnLegal: null,
    },
    fechaActualizacion: new Date(),
    fuenteDatos: params.fuenteDatos,
    totalRegistrosRecibidos: 0,
    urlConsultada: params.urlConsultada,
    statusHttp: params.statusHttp,
    mensajeError: params.mensajeError,
  };
}

async function fetchFaseLegalDMFromApi(): Promise<RespuestaFaseLegalDM> {
  try {
    const response = await fetchConTimeout(ENDPOINT_LEGAL_DM);
    const proxyResponse = await response.json();
    const statusHttp = Number(
      Array.isArray(proxyResponse)
        ? response.status
        : proxyResponse.statusHttp || response.status
    );
    const ok = Boolean(
      Array.isArray(proxyResponse)
        ? response.ok
        : proxyResponse.ok ?? response.ok
    );

    if (!response.ok || !ok) {
      throw new Error(`API legal respondio con status ${statusHttp}`);
    }

    const registros = extraerRegistros(proxyResponse);

    return normalizarTramitesFaseLegalDM({
      registros,
      fuenteDatos: 'API SOL',
      urlConsultada: Array.isArray(proxyResponse)
        ? ENDPOINT_LEGAL_DM
        : String(proxyResponse.sourceUrl || ENDPOINT_LEGAL_DM),
      statusHttp,
      fechaActualizacion: new Date(),
    });
  } catch (error) {
    const mensajeError =
      error instanceof Error ? error.message : 'Error desconocido';

    return respuestaVacia({
      fuenteDatos: 'API SOL',
      mensajeError: `No se pudo cargar la fase legal en vivo. Error: ${mensajeError}`,
      urlConsultada: ENDPOINT_LEGAL_DM,
    });
  }
}

async function fetchFaseLegalDMFromJson(): Promise<RespuestaFaseLegalDM> {
  try {
    const response = await fetchConTimeout(JSON_LOCAL_LEGAL_URL);

    if (response.status === 404) {
      throw new Error(`No existe ${JSON_LOCAL_LEGAL_URL}`);
    }
    if (!response.ok) {
      throw new Error(`JSON local legal respondio con status ${response.status}`);
    }

    const data = await response.json();

    return normalizarTramitesFaseLegalDM({
      registros: extraerRegistros(data),
      fuenteDatos: 'JSON LOCAL',
      urlConsultada: JSON_LOCAL_LEGAL_URL,
      statusHttp: response.status,
      fechaActualizacion: new Date(),
    });
  } catch (error) {
    const mensajeError =
      error instanceof Error ? error.message : 'Error desconocido';

    return respuestaVacia({
      fuenteDatos: 'JSON LOCAL',
      mensajeError: `No se pudo cargar el JSON local de fase legal. Error: ${mensajeError}`,
      urlConsultada: JSON_LOCAL_LEGAL_URL,
    });
  }
}

function respuestaMockLegal(): RespuestaFaseLegalDM {
  return respuestaVacia({
    fuenteDatos: 'MOCK',
    mensajeError: 'No hay mock legal configurado. Active VITE_DATA_SOURCE=api o provea JSON local legal.',
    urlConsultada: 'mock legal',
  });
}

export async function fetchTramitesFaseLegalDM(): Promise<RespuestaFaseLegalDM> {
  if (DATA_SOURCE === 'mock') {
    return USE_MOCK_DATA
      ? respuestaMockLegal()
      : respuestaVacia({
          fuenteDatos: 'MOCK',
          mensajeError:
            'VITE_DATA_SOURCE=mock requiere VITE_USE_MOCK_DATA=true para fase legal.',
          urlConsultada: 'mock legal',
        });
  }

  if (DATA_SOURCE === 'json') return fetchFaseLegalDMFromJson();
  return fetchFaseLegalDMFromApi();
}
