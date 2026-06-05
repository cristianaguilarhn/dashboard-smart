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
const TIMEOUT_MS = 250000;
const DATA_SOURCE = String(import.meta.env.VITE_DATA_SOURCE || 'api').toLowerCase() as DataSource;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';
const JSON_LOCAL_MODULES = import.meta.glob<string>(
  '../data/api-json/*.{json,customization}',
  {
    query: '?raw',
    import: 'default',
  }
);

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

function resolverArchivoJsonLocal(): [string, () => Promise<string>] {
  const archivos = Object.entries(JSON_LOCAL_MODULES);
  if (archivos.length === 0) {
    throw new Error('No hay archivos JSON en src/data/api-json');
  }

  const ordenados = archivos.sort(([a], [b]) => {
    const aEsMetricas = a.toLowerCase().includes('metricas-ugc') ? -1 : 0;
    const bEsMetricas = b.toLowerCase().includes('metricas-ugc') ? -1 : 0;
    if (aEsMetricas !== bEsMetricas) return aEsMetricas - bEsMetricas;
    return a.localeCompare(b);
  });

  return ordenados[0];
}

function resolverArchivoTrazabilidadLocal(): [string, () => Promise<string>] | undefined {
  return Object.entries(JSON_LOCAL_MODULES).find(([ruta]) =>
    ruta.toLowerCase().includes('trasabilidad')
  );
}

export async function fetchMetricasDMFromJson(): Promise<ResultadoFetchTramites> {
  try {
    const [rutaArchivo, cargarArchivo] = resolverArchivoJsonLocal();
    const contenido = await cargarArchivo();
    const data = JSON.parse(contenido) as RespuestaSolCruda;
    const trazabilidadArchivo = resolverArchivoTrazabilidadLocal();
    const trazabilidadData = trazabilidadArchivo
      ? JSON.parse(await trazabilidadArchivo[1]())
      : undefined;
    const nombreArchivo = rutaArchivo.split('/').pop() || rutaArchivo;
    const respuestaCruda = {
      source: 'JSON LOCAL',
      sourceKind: 'JSON_LOCAL',
      fileName: nombreArchivo,
      data,
      trazabilidadData,
    };

    return construirResultadoNormalizado({
      respuestaCruda,
      fuenteDatos: 'JSON LOCAL',
      urlConsultada: rutaArchivo,
      parametroEnviado: 'VITE_DATA_SOURCE=json',
      statusHttp: 200,
      nombreArchivo,
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
      urlConsultada: 'src/data/api-json',
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
