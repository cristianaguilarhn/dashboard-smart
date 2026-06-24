import {
  RespuestaTramitesNormalizada,
  RespuestaSolCruda,
  ResultadoFetchTramites,
  TipoTramite,
} from '../types/sol';
import { normalizarMetricasUgcDM } from './normalizarDatosApiSol';
import { MOCK_RESPUESTA_TRAMITES } from './mockData';

type DataSource = 'api' | 'json' | 'mock';

const ENDPOINT_METRICAS_DM = '/api/sol/metricas-dm';
const JSON_LOCAL_BASE_URL = '/data/api-json';
const JSON_LOCAL_METRICAS_FILE = 'metricas-ugc.customization';
const JSON_LOCAL_TRAZABILIDAD_FILE = 'trasabilidad-tramites.customization';
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

function respuestaVacia(): RespuestaTramitesNormalizada {
  return {
    tramites: [],
    fecha_actualizacion: new Date(),
    total_registros: 0,
    direccion: 'DM',
  };
}

function construirResultadoNormalizado(params: {
  respuestaCruda: RespuestaSolCruda;
  fuenteDatos: 'API REAL' | 'JSON LOCAL' | 'MOCK';
  urlConsultada?: string;
  parametroEnviado?: string;
  statusHttp?: number;
  nombreArchivo?: string;
}): ResultadoFetchTramites {
  const {
    respuestaNormalizada,
    camposNoMapeados,
    camposDetectados,
    totalRegistrosRecibidos,
    primerRegistroCrudo,
  } = normalizarMetricasUgcDM(params.respuestaCruda);

  return {
    datos: respuestaNormalizada,
    esSimulado: params.fuenteDatos === 'MOCK',
    datosCrudos: params.respuestaCruda,
    datosNormalizados: respuestaNormalizada,
    camposNoMapeados,
    camposDetectados,
    cantidadRegistros: respuestaNormalizada.total_registros,
    totalRegistrosRecibidos,
    primerRegistroCrudo,
    nombreArchivo: params.nombreArchivo,
    urlConsultada: params.urlConsultada,
    parametroEnviado: params.parametroEnviado,
    statusHttp: params.statusHttp,
    fuenteDatos: params.fuenteDatos,
  };
}

function resultadoMock(): ResultadoFetchTramites {
  return {
    datos: MOCK_RESPUESTA_TRAMITES,
    esSimulado: true,
    datosNormalizados: MOCK_RESPUESTA_TRAMITES,
    cantidadRegistros: MOCK_RESPUESTA_TRAMITES.total_registros,
    totalRegistrosRecibidos: MOCK_RESPUESTA_TRAMITES.total_registros,
    urlConsultada: 'mockData.ts',
    parametroEnviado: 'VITE_DATA_SOURCE=mock',
    fuenteDatos: 'MOCK',
  };
}

export async function fetchMetricasDMFromApi(): Promise<ResultadoFetchTramites> {
  try {
    const response = await fetchConTimeout(ENDPOINT_METRICAS_DM);
    const proxyResponse = (await response.json()) as RespuestaSolCruda;
    const statusHttp = Number(
      Array.isArray(proxyResponse)
        ? response.status
        : proxyResponse.statusHttp || response.status
    );
    const ok = Boolean(
      Array.isArray(proxyResponse) ? response.ok : proxyResponse.ok ?? response.ok
    );
    const sourceKind = String(
      Array.isArray(proxyResponse) ? 'API REAL' : proxyResponse.sourceKind || proxyResponse.source || ''
    );
    const fuenteDatos = sourceKind.toUpperCase().includes('JSON')
      ? 'JSON LOCAL'
      : 'API REAL';

    if (!response.ok || !ok) {
      throw new Error(`API respondio con status ${statusHttp}`);
    }

    return construirResultadoNormalizado({
      respuestaCruda: proxyResponse,
      fuenteDatos,
      urlConsultada: String(proxyResponse.sourceUrl || ENDPOINT_METRICAS_DM),
      parametroEnviado: 'dm-tramites-fase-tecnica',
      statusHttp,
      nombreArchivo: proxyResponse.fileName || proxyResponse.nombreArchivo,
    });
  } catch (error) {
    const mensajeError =
      error instanceof Error ? error.message : 'Error desconocido';

    return {
      datos: respuestaVacia(),
      esSimulado: false,
      mensajeError: `No se pudo cargar informacion real de SOL. Error: ${mensajeError}`,
      cantidadRegistros: 0,
      totalRegistrosRecibidos: 0,
      urlConsultada: ENDPOINT_METRICAS_DM,
      parametroEnviado: 'dm-tramites-fase-tecnica',
      fuenteDatos: 'API REAL',
    };
  }
}

async function cargarJsonLocal(nombreArchivo: string): Promise<RespuestaSolCruda | undefined> {
  const url = `${JSON_LOCAL_BASE_URL}/${nombreArchivo}`;
  const response = await fetchConTimeout(url);

  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url}. Status HTTP ${response.status}`);
  }

  return (await response.json()) as RespuestaSolCruda;
}

export async function fetchMetricasDMFromJson(): Promise<ResultadoFetchTramites> {
  try {
    const data = await cargarJsonLocal(JSON_LOCAL_METRICAS_FILE);

    if (!data) {
      throw new Error(
        `No existe ${JSON_LOCAL_BASE_URL}/${JSON_LOCAL_METRICAS_FILE}.`
      );
    }

    const trazabilidadData = await cargarJsonLocal(JSON_LOCAL_TRAZABILIDAD_FILE);
    const respuestaCruda = {
      source: 'JSON LOCAL',
      sourceKind: 'JSON_LOCAL',
      fileName: JSON_LOCAL_METRICAS_FILE,
      data,
      trazabilidadData,
    };

    return construirResultadoNormalizado({
      respuestaCruda,
      fuenteDatos: 'JSON LOCAL',
      urlConsultada: `${JSON_LOCAL_BASE_URL}/${JSON_LOCAL_METRICAS_FILE}`,
      parametroEnviado: 'VITE_DATA_SOURCE=json',
      statusHttp: 200,
      nombreArchivo: JSON_LOCAL_METRICAS_FILE,
    });
  } catch (error) {
    const mensajeError =
      error instanceof Error ? error.message : 'Error desconocido';

    return {
      datos: respuestaVacia(),
      esSimulado: false,
      mensajeError: `No se pudo cargar el JSON local. Error: ${mensajeError}`,
      cantidadRegistros: 0,
      totalRegistrosRecibidos: 0,
      urlConsultada: JSON_LOCAL_BASE_URL,
      parametroEnviado: 'VITE_DATA_SOURCE=json',
      fuenteDatos: 'JSON LOCAL',
    };
  }
}

export async function fetchMetricasDM(): Promise<ResultadoFetchTramites> {
  if (DATA_SOURCE === 'mock') {
    if (USE_MOCK_DATA) return resultadoMock();

    return {
      datos: respuestaVacia(),
      esSimulado: false,
      mensajeError:
        'VITE_DATA_SOURCE=mock requiere VITE_USE_MOCK_DATA=true para mostrar simulacion.',
      cantidadRegistros: 0,
      totalRegistrosRecibidos: 0,
      urlConsultada: 'mockData.ts',
      parametroEnviado: 'VITE_DATA_SOURCE=mock',
      fuenteDatos: 'API REAL',
    };
  }
  if (DATA_SOURCE === 'json') return fetchMetricasDMFromJson();
  return fetchMetricasDMFromApi();
}

export async function fetchTrazabilidadDM(): Promise<ResultadoFetchTramites> {
  return fetchMetricasDM();
}

export async function fetchTramitesDM(): Promise<ResultadoFetchTramites> {
  return fetchMetricasDM();
}

export async function fetchTramitesPorDireccion(
  _direccion: TipoTramite
): Promise<ResultadoFetchTramites> {
  return fetchMetricasDM();
}

export async function fetchTramitesAB(): Promise<ResultadoFetchTramites> {
  return fetchMetricasDM();
}

export async function fetchTramitesPF(): Promise<ResultadoFetchTramites> {
  return fetchMetricasDM();
}

export async function fetchTramitesVF(): Promise<ResultadoFetchTramites> {
  return fetchMetricasDM();
}
