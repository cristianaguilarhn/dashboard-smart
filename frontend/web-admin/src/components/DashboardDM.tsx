import { type CSSProperties, type MouseEvent, useEffect, useMemo, useState } from 'react';
import { max, scaleBand, scaleLinear } from 'd3';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchTramitesDM } from '../services/solApi';
import { calcularMetricasDashboard } from '../services/metricas';
import {
  reasignarTramite,
  reasignarTramites,
} from '../services/reasignacionService';
import {
  aplicarFiltroFecha,
  crearFiltroInicial,
  crearFiltroPersonalizado,
  crearFiltroPorPeriodo,
  describirPeriodo,
  formatoInputFecha,
  obtenerDiagnosticoFechas,
} from '../services/filtrosFecha';
import { exportarTramitesExcel } from '../services/exportaciones';
import {
  CargaColaborador,
  FiltroFechaDashboard,
  PeriodoFiltro,
  RetrasoPorFasePersona,
  RespuestaTramitesNormalizada,
  TramiteNormalizado,
} from '../types/sol';
import '../styles/dashboard.css';
import arsaLogo from '../assets/logo-arsa-2026-2030.png';

const FILAS_POR_PAGINA = 10;
type FiltroEtapa = 'todos' | 'gestion';
type FiltroEstadoDashboard =
  | 'todos'
  | 'activo'
  | 'finalizado'
  | 'vencido'
  | 'por_vencer'
  | 'requerido';
type FiltroCondicionTecnica =
  | 'todos'
  | 'en_tiempo'
  | 'por_vencer'
  | 'vencido'
  | 'no_definido';
type FiltroDiasResolucionTecnica =
  | 'todos'
  | '3'
  | '5'
  | '8'
  | '10'
  | '15'
  | '20'
  | '30'
  | '40'
  | '45'
  | '60'
  | '90'
  | 'no_definido';
type FiltroFaseTecnica = 'todos' | 'tecnica' | 'pasado_legal';
type SeccionDashboard =
  | 'tecnica-vivo'
  | 'legal-vivo'
  | 'kpi-tecnico'
  | 'kpi-legal';
type ContextAction = {
  label: string;
  description?: string;
  action: () => void;
};
type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  actions: ContextAction[];
} | null;

const SERIES_PLAZOS_RESOLUCION = [
  { key: 'p3', label: '3 días', plazo: 3, color: '#1e40af', className: 'segment-plazo-3' },
  { key: 'p5', label: '5 días', plazo: 5, color: '#1d4ed8', className: 'segment-plazo-5' },
  { key: 'p8', label: '8 días', plazo: 8, color: '#0369a1', className: 'segment-plazo-8' },
  { key: 'p10', label: '10 días', plazo: 10, color: '#0f766e', className: 'segment-plazo-10' },
  { key: 'p15', label: '15 días', plazo: 15, color: '#15803d', className: 'segment-plazo-15' },
  { key: 'p20', label: '20 días', plazo: 20, color: '#b45309', className: 'segment-plazo-20' },
  { key: 'p30', label: '30 días', plazo: 30, color: '#9a3412', className: 'segment-plazo-30' },
  { key: 'p40', label: '40 días', plazo: 40, color: '#991b1b', className: 'segment-plazo-40' },
  { key: 'p45', label: '45 días', plazo: 45, color: '#7f1d1d', className: 'segment-plazo-45' },
  { key: 'p60', label: '60 días', plazo: 60, color: '#4c1d95', className: 'segment-plazo-60' },
  { key: 'p90', label: '90 días', plazo: 90, color: '#312e81', className: 'segment-plazo-90' },
  {
    key: 'noDefinido',
    label: 'No definido',
    plazo: undefined,
    color: '#64748b',
    className: 'segment-plazo-nd',
  },
] as const;

type SeriePlazoResolucion = (typeof SERIES_PLAZOS_RESOLUCION)[number]['key'];

const MOCK_HOY = new Date('2026-06-03T08:00:00');
const TECNICOS_DM = [
  '19 DM Especialista en Regulacion Sanitaria',
  '13 DM Especialista en Regulacion Sanitaria',
  '07 DM Especialista en Regulacion Sanitaria',
  '24 DM Especialista en Regulacion Sanitaria',
  '31 DM Especialista en Regulacion Sanitaria',
];

type MockEstado = 'vencido' | 'por_vencer' | 'activo';

function crearMockTramite({
  indice,
  tecnico,
  faseActual,
  plazoDias,
  estado,
  diasTranscurridos,
  diasEnFaseTecnica,
  legalIndice,
}: {
  indice: number;
  tecnico: string;
  faseActual: 'tecnica' | 'legal';
  plazoDias: number | null;
  estado: MockEstado;
  diasTranscurridos: number;
  diasEnFaseTecnica?: number;
  legalIndice?: number;
}): TramiteNormalizado {
  const fechaInicio = new Date(2026, 5, 1 + (indice % 3));
  const fechaVencimiento =
    estado === 'vencido'
      ? new Date('2026-06-01T17:00:00')
      : estado === 'por_vencer'
        ? new Date('2026-06-05T17:00:00')
        : new Date('2026-06-18T17:00:00');
  const fechaRevisionTecnica =
    faseActual === 'legal'
      ? new Date(2026, 5, 2, 9 + ((legalIndice || 0) % 6), 0, 0)
      : undefined;
  const plazoNormalizado = plazoDias ?? undefined;

  return {
    id: `DM-MOCK-${String(indice).padStart(4, '0')}`,
    id_tramite: `DM-MOCK-${String(indice).padStart(4, '0')}`,
    tipo: 'DM',
    tipo_tramite: 'Registro sanitario de dispositivo medico',
    estado_final: faseActual === 'legal' ? 'En revision legal' : 'En revision tecnica',
    estado_actual:
      estado === 'por_vencer'
        ? 'proximo'
        : estado === 'vencido'
          ? 'vencido'
          : 'en_tiempo',
    numeroTramite: `DM-2026-${String(indice).padStart(4, '0')}`,
    estado,
    faseActual,
    enSAC: false,
    enGestion: true,
    personaAsignada: faseActual === 'tecnica' ? tecnico : `Legal DM ${(indice % 4) + 1}`,
    descripcion:
      faseActual === 'tecnica'
        ? `Revision tecnica de expediente DM simulado ${indice}`
        : `Expediente DM enviado a legal desde revision tecnica ${indice}`,
    fechaInicio,
    fecha_inicio_gestion: fechaInicio,
    fecha_presentacion: fechaInicio,
    fecha_probable_salida: fechaVencimiento,
    fecha_revision_tecnica: fechaRevisionTecnica,
    usuario_revision_tecnica: fechaRevisionTecnica ? tecnico : undefined,
    fecha_hoy: MOCK_HOY,
    fechaBase: fechaInicio,
    campoFechaBase: 'fecha_inicio_gestion',
    sinFechaIdentificada: false,
    fechaPaseALegal: fechaRevisionTecnica,
    fechaVencimiento,
    fecha_vencimiento: fechaVencimiento,
    diasTranscurridos,
    plazoDias: plazoNormalizado,
    plazo_dias: plazoNormalizado,
    dias_resolucion: plazoNormalizado,
    diasResolucionCalculados: plazoNormalizado,
    plazoDefinido: plazoDias !== null,
    diaActual: diasTranscurridos,
    porcentajeTiempoConsumido: plazoNormalizado
      ? Math.min(100, Math.round((diasTranscurridos / plazoNormalizado) * 100))
      : undefined,
    diasRestantes: plazoNormalizado ? plazoNormalizado - diasTranscurridos : undefined,
    plazoTotal: plazoNormalizado,
    riesgo:
      estado === 'vencido' ? 'alto' : estado === 'por_vencer' ? 'medio' : 'normal',
    cumplimiento: estado === 'vencido' ? 'fuera_de_tiempo' : 'pendiente',
    colaboradorTecnico: tecnico,
    colaboradorLegal: faseActual === 'legal' ? `Legal DM ${(indice % 4) + 1}` : undefined,
    diasEnFaseTecnica: diasEnFaseTecnica ?? diasTranscurridos,
    diasEnFaseLegal: faseActual === 'legal' ? Math.max(1, (indice % 7) + 1) : undefined,
    trazabilidadFasesSuficiente: true,
    direccion: 'DM',
  };
}

let mockIndice = 1;
const MOCK_TRAMITES: TramiteNormalizado[] = [
  ...TECNICOS_DM.flatMap((tecnico, tecnicoIndex) =>
    [5, 10, 15, 20, 30, 40, null, 15].map((plazoDias, itemIndex) =>
      crearMockTramite({
        indice: mockIndice++,
        tecnico,
        faseActual: 'tecnica',
        plazoDias,
        estado:
          itemIndex % 4 === 0
            ? 'vencido'
            : itemIndex % 4 === 1
              ? 'por_vencer'
              : 'activo',
        diasTranscurridos: plazoDias === null ? 4 : Math.max(1, plazoDias - 2 + tecnicoIndex),
      })
    )
  ),
  ...TECNICOS_DM.flatMap((tecnico, tecnicoIndex) =>
    Array.from({ length: 18 - tecnicoIndex }, (_, itemIndex) =>
      crearMockTramite({
        indice: mockIndice++,
        tecnico,
        faseActual: 'legal',
        plazoDias: [5, 10, 15, 20, 30, 40, null][itemIndex % 7],
        estado:
          itemIndex % 5 === 0
            ? 'vencido'
            : itemIndex % 5 === 1
              ? 'por_vencer'
              : 'activo',
        diasTranscurridos: 6 + (itemIndex % 12),
        diasEnFaseTecnica: 3 + (itemIndex % 16),
        legalIndice: itemIndex,
      })
    )
  ),
];

const MOCK_TRAMITES_JSON = MOCK_TRAMITES.map((tramite) => ({
  id: tramite.id,
  id_tramite: tramite.id_tramite,
  numeroTramite: tramite.numeroTramite,
  tipo: tramite.tipo,
  tipo_tramite: tramite.tipo_tramite,
  estado: tramite.estado,
  estado_actual: tramite.estado_actual,
  estado_final: tramite.estado_final,
  faseActual: tramite.faseActual,
  condicion:
    tramite.estado === 'vencido'
      ? 'vencido'
      : tramite.estado === 'por_vencer'
        ? 'proximo'
        : 'en_tiempo',
  enGestion: tramite.enGestion,
  descripcion: tramite.descripcion,
  fecha_inicio_gestion: tramite.fecha_inicio_gestion?.toISOString().slice(0, 10),
  fecha_probable_salida: tramite.fecha_probable_salida?.toISOString().slice(0, 10),
  fecha_revision_tecnica: tramite.fecha_revision_tecnica
    ?.toISOString()
    .slice(0, 10),
  fecha_vencimiento: tramite.fecha_vencimiento?.toISOString().slice(0, 10),
  plazoDias: tramite.plazoDias ?? null,
  diasTranscurridos: tramite.diasTranscurridos,
  diasRestantes: tramite.diasRestantes ?? null,
  diasEnFaseTecnica: tramite.diasEnFaseTecnica ?? null,
  diasEnFaseLegal: tramite.diasEnFaseLegal ?? null,
  colaboradorTecnico: tramite.colaboradorTecnico,
  colaboradorLegal: tramite.colaboradorLegal ?? null,
  direccion: tramite.direccion,
}));

const MOCK_RESPUESTA_TRAMITES: RespuestaTramitesNormalizada = {
  tramites: MOCK_TRAMITES,
  fecha_actualizacion: MOCK_HOY,
  total_registros: MOCK_TRAMITES.length,
  direccion: 'DM',
};

function filtrarDatosDashboard(
  datos: RespuestaTramitesNormalizada | null,
  filtroFecha: FiltroFechaDashboard,
  filtroEtapa: FiltroEtapa,
  filtroEstado: FiltroEstadoDashboard
): RespuestaTramitesNormalizada | null {
  if (!datos) return null;

  const datosPorFecha = aplicarFiltroFecha(datos, filtroFecha);
  const tramites = datosPorFecha.tramites.filter((tramite) => {
    const cumpleEtapa =
      filtroEtapa === 'todos' ||
      (filtroEtapa === 'gestion' && tramite.enGestion);
    const cumpleEstado =
      filtroEstado === 'todos' || tramite.estado === filtroEstado;

    return cumpleEtapa && cumpleEstado;
  });

  return {
    ...datosPorFecha,
    tramites,
    total_registros: tramites.length,
  };
}

function formatearPorcentaje(valor: number): string {
  return `${Math.round(valor * 10) / 10}%`;
}

export function DashboardDM() {
  const mockHabilitado = import.meta.env.VITE_USE_MOCK_DATA === 'true';
  const [datosOriginales, setDatosOriginales] =
    useState<RespuestaTramitesNormalizada | null>(
      mockHabilitado ? MOCK_RESPUESTA_TRAMITES : null
    );
  const [filtroFecha, setFiltroFecha] =
    useState<FiltroFechaDashboard>(crearFiltroInicial);
  const [fechaInicioPersonalizada, setFechaInicioPersonalizada] = useState(() =>
    formatoInputFecha(crearFiltroInicial().fechaInicio || new Date())
  );
  const [fechaFinPersonalizada, setFechaFinPersonalizada] = useState(() =>
    formatoInputFecha(crearFiltroInicial().fechaFin || new Date())
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etiquetaFuente, setEtiquetaFuente] = useState('Desconocida');
  const [mostrarDiagnostico, setMostrarDiagnostico] = useState(false);
  const [datosDiagnostico, setDatosDiagnostico] = useState<any>(null);
  const [paginaSinAsignar, setPaginaSinAsignar] = useState(1);
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>('gestion');
  const [filtroEstado, setFiltroEstado] =
    useState<FiltroEstadoDashboard>('todos');
  const [filteredData, setFilteredData] =
    useState<RespuestaTramitesNormalizada | null>(() =>
      mockHabilitado
        ? filtrarDatosDashboard(
            MOCK_RESPUESTA_TRAMITES,
            crearFiltroInicial(),
            'gestion',
            'todos'
          )
        : null
    );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(
    MOCK_RESPUESTA_TRAMITES.fecha_actualizacion
  );

  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<string>('todos');
  const [filtroCondicionTecnica, setFiltroCondicionTecnica] =
    useState<FiltroCondicionTecnica>('todos');
  const [filtroDiasResolucionTecnica, setFiltroDiasResolucionTecnica] =
    useState<FiltroDiasResolucionTecnica>('todos');
  const [seccionActiva, setSeccionActiva] =
    useState<SeccionDashboard>('tecnica-vivo');
  const [modoOscuro, setModoOscuro] = useState(false);

  const datosFiltrados = filteredData;
  const datosOriginalesVista = datosOriginales ?? datosFiltrados;

  const metricas = useMemo(() => {
    if (!datosFiltrados) return null;
    return calcularMetricasDashboard(datosFiltrados);
  }, [datosFiltrados]);

  const tramitesSinAsignar = useMemo(
    () =>
      datosFiltrados?.tramites.filter(
        (t) => t.enGestion && !t.fechaFinalizacion && !t.colaboradorTecnico
      ) || [],
    [datosFiltrados]
  );

  const tramitesTecnicos = useMemo(
    () =>
      datosFiltrados?.tramites.filter(
        (t) =>
          t.enGestion &&
          !t.fechaFinalizacion &&
          t.faseActual === 'tecnica' &&
          Boolean(t.colaboradorTecnico)
      ) || [],
    [datosFiltrados]
  );

  const tramitesTecnicoSeleccionado = useMemo(() => {
    if (tecnicoSeleccionado === 'todos') return tramitesTecnicos;
    return tramitesTecnicos.filter(
      (tramite) => tramite.colaboradorTecnico === tecnicoSeleccionado
    );
  }, [tecnicoSeleccionado, tramitesTecnicos]);

  const resumenTecnicoSeleccionado = useMemo(
    () => calcularResumenTramitesTecnicos(tramitesTecnicoSeleccionado),
    [tramitesTecnicoSeleccionado]
  );

  const totalPaginasSinAsignar = Math.max(
    1,
    Math.ceil(tramitesSinAsignar.length / FILAS_POR_PAGINA)
  );

  const sinAsignarPaginados = tramitesSinAsignar.slice(
    (paginaSinAsignar - 1) * FILAS_POR_PAGINA,
    paginaSinAsignar * FILAS_POR_PAGINA
  );

  const prioridadTecnicaVivo = useMemo(() => {
    const activos = (datosOriginalesVista?.tramites || []).filter(
      (tramite) => tramite.enGestion && !tramite.fechaFinalizacion
    );
    const requierenAtencion = activos.filter(
      (tramite) =>
        tramite.estado === 'vencido' ||
        tramite.estado === 'por_vencer' ||
        tramite.plazoDias === undefined
    );

    const prioridadEstado = (tramite: TramiteNormalizado) => {
      if (tramite.estado === 'vencido') return 0;
      if (tramite.estado === 'por_vencer') return 1;
      if (tramite.plazoDias === undefined) return 2;
      return 3;
    };

    return {
      resumen: {
        vencidos: activos.filter((tramite) => tramite.estado === 'vencido').length,
        proximos: activos.filter((tramite) => tramite.estado === 'por_vencer').length,
        sinPlazo: activos.filter((tramite) => tramite.plazoDias === undefined).length,
        tecnica: activos.filter((tramite) => tramite.faseActual === 'tecnica').length,
      },
      tramites: requierenAtencion
        .sort((a, b) => {
          const prioridadA = prioridadEstado(a);
          const prioridadB = prioridadEstado(b);
          if (prioridadA !== prioridadB) return prioridadA - prioridadB;
          return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
        }),
    };
  }, [datosOriginalesVista]);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    setFilteredData(
      filtrarDatosDashboard(datosOriginales, filtroFecha, filtroEtapa, filtroEstado)
    );
  }, [datosOriginales, filtroFecha, filtroEtapa, filtroEstado]);

  useEffect(() => {
    setFiltroFecha((actual) =>
      actual.periodo === 'personalizado'
        ? crearFiltroPersonalizado(
            fechaInicioPersonalizada,
            fechaFinPersonalizada,
            actual.incluirSinFecha
          )
        : actual
    );
  }, [fechaInicioPersonalizada, fechaFinPersonalizada]);

  useEffect(() => {
    setPaginaSinAsignar(1);
  }, [filtroFecha, filtroEtapa, filtroEstado, tecnicoSeleccionado]);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);

    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
      const metricasGlobales = calcularMetricasDashboard(MOCK_RESPUESTA_TRAMITES);

      setDatosOriginales(MOCK_RESPUESTA_TRAMITES);
      setFilteredData(
        filtrarDatosDashboard(
          MOCK_RESPUESTA_TRAMITES,
          filtroFecha,
          filtroEtapa,
          filtroEstado
        )
      );
      setEtiquetaFuente('Mock / Simulación');
      setLastUpdate(MOCK_RESPUESTA_TRAMITES.fecha_actualizacion);
      setDatosDiagnostico({
        fuenteDatos: 'MOCK',
        datosCrudos: MOCK_TRAMITES_JSON,
        datosNormalizados: MOCK_RESPUESTA_TRAMITES,
        primerRegistroCrudo: MOCK_TRAMITES_JSON[0],
        cantidadRegistros: MOCK_RESPUESTA_TRAMITES.total_registros,
        totalRegistrosRecibidos: MOCK_RESPUESTA_TRAMITES.total_registros,
        diagnosticoFechas: obtenerDiagnosticoFechas(MOCK_RESPUESTA_TRAMITES.tramites),
        totalActivosCalculados: metricasGlobales.tramitesActivosDM,
        totalFinalizadosCalculados: metricasGlobales.tramitesFinalizados,
        totalFueraTiempoCalculados: metricasGlobales.vencidos,
        totalProximosVencerCalculados: metricasGlobales.porVencer,
        totalEsperandoCiudadanoCalculados:
          metricasGlobales.requeridosAlCiudadano,
        totalEnSAC: metricasGlobales.tramitesEnSAC,
      });
      setCargando(false);
      return;
    }

    try {
      const resultado = await fetchTramitesDM();
      const datosApi = resultado.datos;
      const metricasGlobales = calcularMetricasDashboard(datosApi);

      setDatosOriginales(datosApi);
      setFilteredData(
        filtrarDatosDashboard(datosApi, filtroFecha, filtroEtapa, filtroEstado)
      );
      setEtiquetaFuente('API SOL fase tecnica');
      setLastUpdate(datosApi.fecha_actualizacion);
      setDatosDiagnostico({
        fuenteDatos: resultado.fuenteDatos,
        datosCrudos: resultado.datosCrudos,
        datosNormalizados: datosApi,
        primerRegistroCrudo: resultado.primerRegistroCrudo,
        camposDetectados: resultado.camposDetectados,
        camposNoMapeados: resultado.camposNoMapeados,
        cantidadRegistros: datosApi.total_registros,
        totalRegistrosRecibidos:
          resultado.totalRegistrosRecibidos || datosApi.total_registros,
        diagnosticoFechas: obtenerDiagnosticoFechas(datosApi.tramites),
        totalActivosCalculados: metricasGlobales.tramitesActivosDM,
        totalFinalizadosCalculados: metricasGlobales.tramitesFinalizados,
        totalFueraTiempoCalculados: metricasGlobales.vencidos,
        totalProximosVencerCalculados: metricasGlobales.porVencer,
        totalEsperandoCiudadanoCalculados:
          metricasGlobales.requeridosAlCiudadano,
        totalEnSAC: metricasGlobales.tramitesEnSAC,
        urlConsultada: resultado.urlConsultada,
        parametroEnviado: resultado.parametroEnviado,
        statusHttp: resultado.statusHttp,
      });
      if (resultado.mensajeError) {
        setError(resultado.mensajeError);
      }
    } catch (err) {
      setDatosOriginales(null);
      setFilteredData(null);
      setEtiquetaFuente('API SOL');
      setLastUpdate(null);
      setError(
        err instanceof Error
          ? `No se pudo cargar información real de SOL. ${err.message}`
          : 'No se pudo cargar información real de SOL.'
      );
    } finally {
      setCargando(false);
    }
    return;

    // Si VITE_USE_MOCK_DATA es true, usar datos de simulación
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
      setDatosOriginales(MOCK_RESPUESTA_TRAMITES);
      setEtiquetaFuente('Mock / Simulación');
      setLastUpdate(MOCK_RESPUESTA_TRAMITES.fecha_actualizacion);
      setCargando(false);
      return;
    }

    try {
      const response = await fetch('/api/sol/metricas-dm');
      if (!response.ok) {
        throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'La API no devolvió un resultado exitoso.');
      }

      // La API del backend ya debería devolver datos normalizados en `result.data`
      // con la estructura de RespuestaTramitesNormalizada.
      const datosNormalizados: RespuestaTramitesNormalizada = {
        ...result.data,
        // Las fechas pueden venir como strings desde el JSON
        fecha_actualizacion: new Date(result.data.fecha_actualizacion),
        tramites: result.data.tramites.map((tramite: any) => ({
          ...tramite,
          fechaInicio: new Date(tramite.fechaInicio),
          fecha_inicio_gestion: tramite.fecha_inicio_gestion ? new Date(tramite.fecha_inicio_gestion) : undefined,
          fecha_presentacion: tramite.fecha_presentacion ? new Date(tramite.fecha_presentacion) : undefined,
          fecha_probable_salida: tramite.fecha_probable_salida ? new Date(tramite.fecha_probable_salida) : undefined,
          fecha_revision_tecnica: tramite.fecha_revision_tecnica ? new Date(tramite.fecha_revision_tecnica) : undefined,
          fecha_finalizacion: tramite.fecha_finalizacion ? new Date(tramite.fecha_finalizacion) : undefined,
          fechaVencimiento: tramite.fechaVencimiento ? new Date(tramite.fechaVencimiento) : undefined,
          fecha_vencimiento: tramite.fecha_vencimiento ? new Date(tramite.fecha_vencimiento) : undefined,
          fecha_hoy: tramite.fecha_hoy ? new Date(tramite.fecha_hoy) : new Date(),
        })),
      };

      setDatosOriginales(datosNormalizados);
      setEtiquetaFuente(result.source || 'API SOL');
      setLastUpdate(datosNormalizados.fecha_actualizacion);
      setDatosDiagnostico(result.diagnostics);

    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido');
      setDatosOriginales(null);
    } finally {
      setCargando(false);
    }
  };

  const cambiarPeriodo = (periodo: PeriodoFiltro) => {
    if (periodo === 'personalizado') {
      setFiltroFecha(
        crearFiltroPersonalizado(
          fechaInicioPersonalizada,
          fechaFinPersonalizada,
          filtroFecha.incluirSinFecha
        )
      );
      return;
    }

    const nuevoFiltro = crearFiltroPorPeriodo(periodo);
    nuevoFiltro.incluirSinFecha = filtroFecha.incluirSinFecha;
    setFiltroFecha(nuevoFiltro);

    if (nuevoFiltro.fechaInicio) {
      setFechaInicioPersonalizada(formatoInputFecha(nuevoFiltro.fechaInicio));
    }
    if (nuevoFiltro.fechaFin) {
      setFechaFinPersonalizada(formatoInputFecha(nuevoFiltro.fechaFin));
    }
  };

  const aplicarRangoPersonalizado = () => {
    setFiltroFecha(
      crearFiltroPersonalizado(
        fechaInicioPersonalizada,
        fechaFinPersonalizada,
        filtroFecha.incluirSinFecha
      )
    );
  };

  const cambiarIncluirSinFecha = (incluirSinFecha: boolean) => {
    setFiltroFecha((actual) => ({ ...actual, incluirSinFecha }));
  };

  const exportarFiltrados = (nombre: string, tramites: TramiteNormalizado[]) => {
    exportarTramitesExcel(nombre, tramites);
  };

  if (cargando) {
    return (
      <div
        data-theme={modoOscuro ? 'arsaDark' : 'arsaLight'}
        className={`dashboard-container ${modoOscuro ? 'dark-dashboard' : ''}`}
      >
        <span className="loading loading-spinner loading-sm"></span>
        Cargando...
      </div>
    );
  }

  if (!datosFiltrados || !metricas || !datosOriginalesVista) {
    return (
      <div
        data-theme={modoOscuro ? 'arsaDark' : 'arsaLight'}
        className={`dashboard-container ${modoOscuro ? 'dark-dashboard' : ''}`}
      >
        <div className="dashboard-header">
          <h1>Dashboard Ejecutivo SOL - Dispositivos Médicos</h1>
          <p className="dashboard-subtitle">
            {error || 'No hay datos disponibles'}
          </p>
          <div className="dashboard-controls">
            <button onClick={cargarDatos} className="btn btn-primary btn-sm">
              Actualizar
            </button>
            <label className="theme-toggle-control">
              <span>Claro</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={modoOscuro}
                onChange={() => setModoOscuro((valor) => !valor)}
              />
              <span>Oscuro</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  const esSimulacion = etiquetaFuente.toLowerCase().includes('mock');

  return (
    <div
      data-theme={modoOscuro ? 'arsaDark' : 'arsaLight'}
      className={`dashboard-container ${modoOscuro ? 'dark-dashboard' : ''}`}
    >
      <div className="dashboard-header">
        <div className="dashboard-brand-row">
          <div className="dashboard-logo-shell">
            <img src={arsaLogo} alt="ARSA" className="dashboard-logo" />
          </div>
          <div className="dashboard-title-block">
            <span className="dashboard-kicker">Agencia de Regulación Sanitaria</span>
            <h1>Dashboard Ejecutivo SOL - Dispositivos Médicos</h1>
            <p className="dashboard-subtitle">
              Seguimiento de productividad, tiempos de gestión y casos que requieren
              atención
            </p>
            <div className="arsa-gold-detail" aria-hidden="true">
              <span></span>
              <i>★</i>
              <i>★</i>
              <i>★</i>
            </div>
          </div>
        </div>

        {esSimulacion && (
          <div className="alert alert-info">
            <strong>Modo Simulación:</strong> Se están mostrando datos de
            ejemplo. La API de SOL no está disponible.
          </div>
        )}

        <div className="dashboard-controls">
          <button onClick={cargarDatos} className="btn btn-primary btn-sm">
            Recargar
          </button>
          <label className="theme-toggle-control">
            <span>Claro</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={modoOscuro}
              onChange={() => setModoOscuro((valor) => !valor)}
            />
            <span>Oscuro</span>
          </label>
          <button
            onClick={() =>
              exportarFiltrados('tramites-filtrados', datosFiltrados.tramites)
            }
            className="btn btn-outline btn-sm"
          >
            Exportar trámites filtrados
          </button>
          <button
            onClick={() => setMostrarDiagnostico(!mostrarDiagnostico)}
            className={`btn btn-ghost btn-sm ${mockHabilitado ? '' : 'hidden'}`}
          >
            {mostrarDiagnostico ? 'Ocultar diagnóstico' : 'Diagnóstico de datos'}
          </button>
          <span className="last-update badge badge-success badge-outline">
            Fuente: {etiquetaFuente}
          </span>
          <span className="last-update badge badge-info badge-outline">
            Registros cargados: {datosOriginales?.total_registros.toLocaleString('es-HN') ?? 0}
          </span>
          <span className="last-update badge badge-primary badge-outline">
            Registros filtrados: {datosFiltrados?.total_registros.toLocaleString('es-HN') ?? 0}
          </span>
          <span className="last-update badge badge-outline tooltip tooltip-primary" data-tip="Hora del ultimo corte cargado desde SOL">
            Actualizado: {datosOriginalesVista.fecha_actualizacion.toLocaleString('es-HN')}
          </span>
        </div>
      </div>

      <nav className="dashboard-section-nav" aria-label="Secciones del dashboard SOL">
        {[
          ['tecnica-vivo', 'Fase técnica en vivo'],
          ['legal-vivo', 'Fase legal en vivo'],
          ['kpi-tecnico', 'KPI técnico histórico'],
          ['kpi-legal', 'KPI legal histórico'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`section-nav-button ${
              seccionActiva === id ? 'active' : ''
            }`}
            onClick={() => setSeccionActiva(id as SeccionDashboard)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Secciones del dashboard viejo ocultas */}
      <div className="section deferred-stage" style={{ display: 'none' }}>
        <div className="section-title-row">
          <h2>Trámites sin asignar ({tramitesSinAsignar.length})</h2>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => exportarFiltrados('tramites-sin-asignar', tramitesSinAsignar)}
          >
            Exportar sin asignar
          </button>
        </div>
        <TablaTramitesDetallada tramites={sinAsignarPaginados} />
        <div className="pagination">
          <button
            className="btn btn-outline btn-sm"
            disabled={paginaSinAsignar === 1}
            onClick={() => setPaginaSinAsignar((pagina) => Math.max(1, pagina - 1))}
          >
            Anterior
          </button>
          <span>
            Página {paginaSinAsignar} de {totalPaginasSinAsignar}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={paginaSinAsignar === totalPaginasSinAsignar}
            onClick={() =>
              setPaginaSinAsignar((pagina) =>
                Math.min(totalPaginasSinAsignar, pagina + 1)
              )
            }
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="section deferred-stage" style={{ display: 'none' }}>
        <h2>Carga por Colaborador Técnico</h2>
        <div className="carga-colaboradores">
          {Object.entries(metricas.cargaPorColaborador).map(
            ([colaborador, cantidad]) => (
              <div key={colaborador} className="colaborador-item">
                <span className="colaborador-nombre">{colaborador}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        (cantidad /
                          Math.max(
                            ...Object.values(metricas.cargaPorColaborador),
                            1
                          )) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
                <span className="cantidad">{cantidad}</span>
              </div>
            )
          )}
        </div>
      </div>

      {seccionActiva === 'tecnica-vivo' && (
        <>
          <PanelPrioridadOperativa
            resumen={prioridadTecnicaVivo.resumen}
            tramites={prioridadTecnicaVivo.tramites}
          />
          <DashboardTecnico
            tramites={datosOriginalesVista.tramites}
            tecnicoSeleccionado={tecnicoSeleccionado}
            setTecnicoSeleccionado={setTecnicoSeleccionado}
            filtroCondicion={filtroCondicionTecnica}
            setFiltroCondicion={setFiltroCondicionTecnica}
            filtroDiasResolucion={filtroDiasResolucionTecnica}
            setFiltroDiasResolucion={setFiltroDiasResolucionTecnica}
            fechaDesde={fechaInicioPersonalizada}
            fechaHasta={fechaFinPersonalizada}
            setFechaDesde={setFechaInicioPersonalizada}
            setFechaHasta={setFechaFinPersonalizada}
            aplicarFechas={aplicarRangoPersonalizado}
            actualizarDatos={cargarDatos}
            exportarFiltrados={exportarFiltrados}
            mostrarFiltroFecha={false}
            fechaActualizacion={datosOriginalesVista.fecha_actualizacion}
          />
        </>
      )}

      {seccionActiva === 'legal-vivo' && (
        <DashboardLegalVivo
          tramites={datosOriginalesVista.tramites}
          actualizarDatos={cargarDatos}
          fechaActualizacion={datosOriginalesVista.fecha_actualizacion}
        />
      )}

      {seccionActiva === 'kpi-tecnico' && (
        <DashboardHistoricoTecnico
          tramites={datosFiltrados.tramites}
          fechaDesde={fechaInicioPersonalizada}
          fechaHasta={fechaFinPersonalizada}
          setFechaDesde={setFechaInicioPersonalizada}
          setFechaHasta={setFechaFinPersonalizada}
          aplicarFechas={aplicarRangoPersonalizado}
          actualizarDatos={cargarDatos}
        />
      )}

      {seccionActiva === 'kpi-legal' && (
        <DashboardHistoricoLegal
          tramites={datosFiltrados.tramites}
          fechaDesde={fechaInicioPersonalizada}
          fechaHasta={fechaFinPersonalizada}
          setFechaDesde={setFechaInicioPersonalizada}
          setFechaHasta={setFechaFinPersonalizada}
          aplicarFechas={aplicarRangoPersonalizado}
          actualizarDatos={cargarDatos}
        />
      )}

      <div className="section legacy-technical-section deferred-stage" style={{ display: 'none' }}>
        <div className="section-title-row">
          <h2>Carga por técnico</h2>
          <label className="filter-inline">
            Técnico
            <select
              value={tecnicoSeleccionado}
              onChange={(event) => setTecnicoSeleccionado(event.target.value)}
            >
              <option value="todos">Todos los técnicos</option>
              {metricas.cargaTecnica.map((item) => (
                <option key={item.colaborador} value={item.colaborador}>
                  {item.colaborador}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TablaCargaTecnicos carga={metricas.cargaTecnica} />
      </div>

      {tecnicoSeleccionado !== 'todos' && false && ( // Oculto explícitamente
        <div className="section">
          <div className="section-title-row">
            <h2>Detalle de carga del técnico</h2>
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                exportarFiltrados(
                  `detalle-${tecnicoSeleccionado}`,
                  tramitesTecnicoSeleccionado
                )
              }
            >
              Exportar detalle
            </button>
          </div>
          <ResumenTecnico resumen={resumenTecnicoSeleccionado} />
          <TablaTramitesTecnico tramites={tramitesTecnicoSeleccionado} />
        </div>
      )}

      <div className="section deferred-stage" style={{ display: 'none' }}>
        <h2>Carga real por persona</h2>
        <h3>Técnicos</h3>
        <TablaCargaOperativa carga={metricas.cargaTecnica} />
        <h3>Legales</h3>
        <TablaCargaOperativa carga={metricas.cargaLegal} />
      </div>

      {mostrarDiagnostico && datosDiagnostico && (
        <DiagnosticoVista_Legacy
          diagnostico={datosDiagnostico}
          totalFiltradosPorFecha={datosFiltrados.total_registros}
        />
      )}

    </div>
  );
}

function DiagnosticoVista_Legacy(props: any) {
  return <div />;
}

function MetricCard({
  valor,
  etiqueta,
  variante,
  acciones,
  onOpenActions,
  onContextMenuAction,
}: {
  valor: number;
  etiqueta: string;
  variante?: 'warning' | 'alert' | 'success' | 'info';
  acciones?: ContextAction[];
  onOpenActions?: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenuAction?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const esAccionable = Boolean(acciones?.length && onOpenActions);

  return (
    <div
      className={`metric-card ${variante ? `metric-${variante}` : ''} ${
        esAccionable ? 'metric-card-actionable' : ''
      }`}
      onContextMenu={onContextMenuAction}
    >
      {esAccionable && (
        <button
          className="context-trigger-button"
          type="button"
          onClick={onOpenActions}
          aria-label={`Acciones de ${etiqueta}`}
        >
          ⋮
        </button>
      )}
      <div className="metric-value">{valor}</div>
      <div className="metric-label">{etiqueta}</div>
    </div>
  );
}

function ContextActionMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!menu) return;

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const cerrarConClick = () => onClose();

    window.addEventListener('keydown', cerrarConEscape);
    window.addEventListener('click', cerrarConClick);

    return () => {
      window.removeEventListener('keydown', cerrarConEscape);
      window.removeEventListener('click', cerrarConClick);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div
      className="context-action-menu"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      role="menu"
      aria-label={`Acciones: ${menu.title}`}
    >
      <div className="context-action-menu-header">{menu.title}</div>
      {menu.actions.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          <span>{item.label}</span>
          {item.description && <small>{item.description}</small>}
        </button>
      ))}
    </div>
  );
}

function PanelPrioridadOperativa({
  resumen,
  tramites,
}: {
  resumen: {
    vencidos: number;
    proximos: number;
    sinPlazo: number;
    tecnica: number;
  };
  tramites: TramiteNormalizado[];
}) {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<'todos' | 'vencido' | 'por_vencer' | 'sin_plazo'>(
    'todos'
  );
  const filasPorPagina = 6;
  const tramitesFiltrados = useMemo(
    () =>
      tramites.filter((tramite) => {
        if (filtro === 'vencido') return tramite.estado === 'vencido';
        if (filtro === 'por_vencer') return tramite.estado === 'por_vencer';
        if (filtro === 'sin_plazo') return tramite.plazoDias === undefined;
        return true;
      }),
    [filtro, tramites]
  );
  const totalPaginas = Math.max(1, Math.ceil(tramitesFiltrados.length / filasPorPagina));
  const inicio = (pagina - 1) * filasPorPagina;
  const tramitesPagina = tramitesFiltrados.slice(inicio, inicio + filasPorPagina);

  useEffect(() => {
    setPagina(1);
  }, [filtro, tramites]);

  return (
    <section className="priority-panel">
      <div className="priority-header">
        <div>
          <h2>Prioridad operativa actual</h2>
          <p>
            Alertas del corte actual de SOL para actuar sobre vencidos, próximos
            a vencer y trámites sin plazo definido.
          </p>
        </div>
        <span className="priority-badge">{resumen.tecnica} activos en técnica</span>
      </div>

      <div className="priority-kpis">
        <MetricCard valor={resumen.vencidos} etiqueta="Vencidos" variante="warning" />
        <MetricCard valor={resumen.proximos} etiqueta="Próximos a vencer" variante="alert" />
        <MetricCard valor={resumen.sinPlazo} etiqueta="Sin plazo definido" variante="info" />
      </div>

      <div className="priority-carousel-toolbar">
        <div className="priority-filter-group" aria-label="Filtros de prioridad operativa">
          {[
            ['todos', 'Todos'],
            ['vencido', 'Vencidos'],
            ['por_vencer', 'Próximos'],
            ['sin_plazo', 'Sin plazo'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`priority-filter-button ${filtro === id ? 'active' : ''}`}
              onClick={() => setFiltro(id as typeof filtro)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="priority-carousel-controls">
          <span>
            {tramitesFiltrados.length === 0
              ? 'Sin trámites para revisar'
              : `Mostrando ${inicio + 1}-${Math.min(
                  inicio + filasPorPagina,
                  tramitesFiltrados.length
                )} de ${tramitesFiltrados.length}`}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={pagina === 1}
            onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
          >
            Anterior
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={pagina === totalPaginas || tramitesFiltrados.length === 0}
            onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="priority-list">
        {tramitesPagina.map((tramite) => (
          <article className={`priority-item priority-${tramite.estado}`} key={tramite.id}>
            <div className="priority-card-top">
              <strong className="priority-expediente">
                {tramite.numeroTramite || tramite.id}
              </strong>
              <span className={`priority-status status-${tramite.estado}`}>
                {obtenerCondicion(tramite)}
              </span>
            </div>
            <div className="priority-card-person" title={tramite.colaboradorTecnico || 'Sin técnico asignado'}>
              {obtenerCodigoTecnico(tramite.colaboradorTecnico)}
            </div>
            <dl className="priority-card-meta">
              <div>
                <dt>Fase</dt>
                <dd>{tramite.faseActual}</dd>
              </div>
              <div>
                <dt>Vence</dt>
                <dd>{formatearFecha(tramite.fechaVencimiento)}</dd>
              </div>
              <div>
                <dt>Días restantes</dt>
                <dd>{formatearNumero(tramite.diasRestantes)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      {tramitesFiltrados.length === 0 && (
        <p className="empty-state">No hay trámites en esta categoría de prioridad.</p>
      )}
    </section>
  );
}

function FiltrosHistoricos({
  fechaDesde,
  fechaHasta,
  setFechaDesde,
  setFechaHasta,
  aplicarFechas,
  actualizarDatos,
}: {
  fechaDesde: string;
  fechaHasta: string;
  setFechaDesde: (value: string) => void;
  setFechaHasta: (value: string) => void;
  aplicarFechas: () => void;
  actualizarDatos: () => void;
}) {
  const aplicarRangoRapido = (inicio: Date, fin: Date) => {
    setFechaDesde(formatoInputFecha(inicio));
    setFechaHasta(formatoInputFecha(fin));
    window.setTimeout(aplicarFechas, 0);
  };

  const seleccionarHoy = () => {
    const hoy = new Date();
    aplicarRangoRapido(hoy, hoy);
  };

  const seleccionarSemana = () => {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    aplicarRangoRapido(inicio, hoy);
  };

  const seleccionarMes = () => {
    const hoy = new Date();
    aplicarRangoRapido(new Date(hoy.getFullYear(), hoy.getMonth(), 1), hoy);
  };

  const seleccionarUltimos30 = () => {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - 29);
    aplicarRangoRapido(inicio, hoy);
  };

  const restablecer = () => {
    const hoy = new Date();
    aplicarRangoRapido(new Date(hoy.getFullYear(), hoy.getMonth(), 1), hoy);
  };

  return (
    <div className="historical-filter-panel">
      <div className="historical-filter-header">
        <div>
          <h3>Filtro de análisis histórico</h3>
          <p>Selecciona el rango de fechas para evaluar la gestión realizada.</p>
        </div>
      </div>
      <div className="quick-range-buttons" aria-label="Selector rápido de fecha">
        <button className="quick-range-button btn btn-ghost btn-sm" onClick={seleccionarHoy}>
          Hoy
        </button>
        <button className="quick-range-button btn btn-ghost btn-sm" onClick={seleccionarSemana}>
          Esta semana
        </button>
        <button className="quick-range-button btn btn-ghost btn-sm" onClick={seleccionarMes}>
          Este mes
        </button>
        <button className="quick-range-button btn btn-ghost btn-sm" onClick={seleccionarUltimos30}>
          Últimos 30 días
        </button>
        <button className="quick-range-button btn btn-ghost btn-sm" type="button">
          Rango personalizado
        </button>
      </div>
      <div className="historical-filter-bar">
        <label>
          Fecha desde
          <input
            type="date"
            value={fechaDesde}
            onChange={(event) => setFechaDesde(event.target.value)}
          />
        </label>
        <label>
          Fecha hasta
          <input
            type="date"
            value={fechaHasta}
            onChange={(event) => setFechaHasta(event.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-sm" onClick={aplicarFechas}>
          Aplicar filtro
        </button>
        <button className="btn btn-outline btn-sm" onClick={restablecer}>
          Limpiar filtro / Restablecer
        </button>
        <button className="btn btn-primary btn-sm" onClick={actualizarDatos}>
          Actualizar
        </button>
      </div>
    </div>
  );
}

function DashboardLegalVivo({
  tramites,
  actualizarDatos,
  fechaActualizacion,
}: {
  tramites: TramiteNormalizado[];
  actualizarDatos: () => void;
  fechaActualizacion?: Date;
}) {
  const activosLegal = obtenerTramitesLegalActivos(tramites);
  const cargaLegal = calcularCargaLegal(tramites);
  const margenCritico = activosLegal.filter((tramite) =>
    ['Margen crítico', 'Margen ajustado', 'Tarde'].includes(clasificarMargenLegal(tramite))
  );
  const maxCarga = Math.max(...cargaLegal.map((row) => row.total), 1);

  return (
    <div className="section live-section">
      <div className="section-title-row">
        <div>
          <h2>Fase legal en vivo</h2>
          <div className="live-status">
            <span className="live-badge">Datos en vivo / corte actual</span>
            {fechaActualizacion && (
              <span>
                Última actualización: {fechaActualizacion.toLocaleString('es-HN')}
              </span>
            )}
          </div>
          <p className="section-subtitle">
            Carga legal activa, vencimientos y margen recibido desde técnica.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={actualizarDatos}>
          Actualizar
        </button>
      </div>

      <div className="summary-grid">
        <MetricCard valor={activosLegal.length} etiqueta="Total en fase legal" />
        <MetricCard
          valor={cargaLegal.length}
          etiqueta="Legales con carga"
          variante="info"
        />
        <MetricCard
          valor={activosLegal.filter((t) => t.estado === 'por_vencer').length}
          etiqueta="Próximos a vencer"
          variante="alert"
        />
        <MetricCard
          valor={margenCritico.length}
          etiqueta="Margen crítico desde técnica"
          variante="warning"
        />
      </div>

      <div className="tramites-table-wrapper">
        <table className="tramites-table executive-table">
          <thead>
            <tr>
              <th>Legal / oficial</th>
              <th>Total</th>
              <th>Próximos</th>
              <th>Vencidos</th>
              <th>Requeridos</th>
              <th>Margen crítico</th>
              <th>Carga</th>
            </tr>
          </thead>
          <tbody>
            {cargaLegal.map((row) => (
              <tr key={row.responsable}>
                <td className="cell-id">{row.responsable}</td>
                <td>{row.total}</td>
                <td>{row.proximos}</td>
                <td>{row.vencidos}</td>
                <td>{row.requeridos}</td>
                <td>{row.margenCritico}</td>
                <td>
                  <div className="load-cell">
                    <div className="load-track">
                      <div
                        className="load-bar"
                        style={{ width: `${Math.max(4, (row.total / maxCarga) * 100)}%` }}
                      />
                    </div>
                    <span>{row.total}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {margenCritico.length === 0 ? (
        <p className="empty-state">Sin trámites enviados a legal con margen crítico.</p>
      ) : (
        <TablaTramitesPasadosLegal tramites={margenCritico.slice(0, 20)} />
      )}
    </div>
  );
}

function DashboardHistoricoTecnico({
  tramites,
  fechaDesde,
  fechaHasta,
  setFechaDesde,
  setFechaHasta,
  aplicarFechas,
  actualizarDatos,
}: {
  tramites: TramiteNormalizado[];
  fechaDesde: string;
  fechaHasta: string;
  setFechaDesde: (value: string) => void;
  setFechaHasta: (value: string) => void;
  aplicarFechas: () => void;
  actualizarDatos: () => void;
}) {
  const historico = calcularHistoricoTecnico(tramites);

  return (
    <div className="section historical-section">
      <div className="section-title-row">
        <div>
          <h2>KPI técnico histórico</h2>
          <p className="section-subtitle">
            Evaluación por rango de fecha: oportunidad, margen a legal y tiempo técnico.
          </p>
        </div>
      </div>
      <FiltrosHistoricos
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        setFechaDesde={setFechaDesde}
        setFechaHasta={setFechaHasta}
        aplicarFechas={aplicarFechas}
        actualizarDatos={actualizarDatos}
      />
      <div className="summary-grid">
        <MetricCard valor={historico.gestionados} etiqueta="Trámites gestionados" />
        <MetricCard valor={historico.pasadosLegal} etiqueta="Pasados a legal" />
        <MetricCard valor={historico.promedioTecnica} etiqueta="Prom. días técnica" />
        <MetricCard
          valor={historico.margenSaludable}
          etiqueta="Margen saludable"
          variante="success"
        />
        <MetricCard
          valor={historico.margenAjustado}
          etiqueta="Margen ajustado"
          variante="warning"
        />
        <MetricCard valor={historico.margenCritico} etiqueta="Margen crítico" variante="alert" />
        <MetricCard valor={historico.tarde} etiqueta="Pases tardíos" variante="alert" />
      </div>
    </div>
  );
}

function DashboardHistoricoLegal({
  tramites,
  fechaDesde,
  fechaHasta,
  setFechaDesde,
  setFechaHasta,
  aplicarFechas,
  actualizarDatos,
}: {
  tramites: TramiteNormalizado[];
  fechaDesde: string;
  fechaHasta: string;
  setFechaDesde: (value: string) => void;
  setFechaHasta: (value: string) => void;
  aplicarFechas: () => void;
  actualizarDatos: () => void;
}) {
  const historico = calcularHistoricoLegal(tramites);

  return (
    <div className="section historical-section">
      <div className="section-title-row">
        <div>
          <h2>KPI legal histórico</h2>
          <p className="section-subtitle">
            Evaluación por rango de fecha: oportunidad legal, requerimientos y subsanaciones.
          </p>
        </div>
      </div>
      <FiltrosHistoricos
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        setFechaDesde={setFechaDesde}
        setFechaHasta={setFechaHasta}
        aplicarFechas={aplicarFechas}
        actualizarDatos={actualizarDatos}
      />
      <div className="summary-grid">
        <MetricCard valor={historico.totalLegal} etiqueta="Trámites legal" />
        <MetricCard valor={historico.aprobados} etiqueta="Aprobados" variante="success" />
        <MetricCard valor={historico.requeridos} etiqueta="Requeridos" variante="warning" />
        <MetricCard valor={historico.promedioLegal} etiqueta="Prom. días legal" />
        <MetricCard valor={historico.proximos} etiqueta="Próximos a vencer" variante="alert" />
        <MetricCard valor={historico.vencidos} etiqueta="Vencidos" variante="alert" />
        <MetricCard valor={historico.subsanacion} etiqueta="En subsanación" variante="info" />
      </div>
    </div>
  );
}

function formatearFecha(fecha?: Date): string {
  return fecha ? fecha.toLocaleDateString('es-HN') : 'Sin dato';
}

function formatearNumero(valor?: number): string {
  return valor === undefined || Number.isNaN(valor)
    ? 'No definido'
    : valor.toLocaleString('es-HN');
}

function obtenerNomenclaturaTramite(tramite: TramiteNormalizado): string {
  const texto = [
    tramite.tipo_tramite,
    tramite.descripcion,
    tramite.tipo,
    tramite.estado_final,
  ]
    .filter(Boolean)
    .join(' ');
  const match = texto.match(/\bDM\s*0?\d{1,3}\b/i);

  if (match) return match[0].replace(/\s+/g, '').toUpperCase();
  return tramite.tipo?.toUpperCase() || 'DM';
}

function obtenerCodigoTecnico(nombre?: string): string {
  if (!nombre) return 'Sin asignar';
  const match = nombre.match(/\bT\s*-\s*\d+\b/i) || nombre.match(/\bT\d+\b/i);
  if (!match) return nombre;
  const codigo = match[0].replace(/\s+/g, '').toUpperCase();
  return nombre.toUpperCase().includes('DM') ? `${codigo} DM` : codigo;
}

function formatearTrazabilidad(tramite: TramiteNormalizado, valor?: number): string {
  if (valor !== undefined) return valor.toLocaleString('es-HN');
  return tramite.diagnosticoTrazabilidad || 'Sin trazabilidad suficiente';
}

function obtenerCondicion(tramite: TramiteNormalizado): string {
  if (tramite.estado === 'vencido') return 'Vencido';
  if (tramite.estado === 'por_vencer') return 'Próximo a vencer';
  return 'En tiempo';
}

function calcularResumenTramitesTecnicos(tramites: TramiteNormalizado[]) {
  return {
    total: tramites.length,
    plazo5: tramites.filter((t) => t.plazoDias === 5).length,
    plazo10: tramites.filter((t) => t.plazoDias === 10).length,
    plazo15: tramites.filter((t) => t.plazoDias === 15).length,
    plazoNoDefinido: tramites.filter((t) => t.plazoDias === undefined).length,
    vencidos: tramites.filter((t) => t.estado === 'vencido').length,
    proximos: tramites.filter((t) => t.estado === 'por_vencer').length,
  };
}

function construirMatrizTecnicos(
  tramites: TramiteNormalizado[],
  pasadosLegal: ReturnType<typeof construirPasadosLegal> = []
) {
  const rows = new Map<
    string,
    {
      tecnico: string;
      p3: number;
      p5: number;
      p8: number;
      p10: number;
      p15: number;
      p20: number;
      p30: number;
      p40: number;
      p45: number;
      p60: number;
      p90: number;
      noDefinido: number;
      total: number;
      pasadosLegal: number;
      cargaPonderada: number;
      vencidos: number;
      proximos: number;
    }
  >();

  tramites.forEach((tramite) => {
    const tecnico = tramite.colaboradorTecnico;
    if (!tecnico) return;
    if (!rows.has(tecnico)) {
      rows.set(tecnico, {
        tecnico,
        p3: 0,
        p5: 0,
        p8: 0,
        p10: 0,
        p15: 0,
        p20: 0,
        p30: 0,
        p40: 0,
        p45: 0,
        p60: 0,
        p90: 0,
        noDefinido: 0,
        total: 0,
        pasadosLegal: 0,
        cargaPonderada: 0,
        vencidos: 0,
        proximos: 0,
      });
    }
    const row = rows.get(tecnico)!;
    row.total += 1;
    if (tramite.plazoDias === 3) row.p3 += 1;
    else if (tramite.plazoDias === 5) row.p5 += 1;
    else if (tramite.plazoDias === 8) row.p8 += 1;
    else if (tramite.plazoDias === 10) row.p10 += 1;
    else if (tramite.plazoDias === 15) row.p15 += 1;
    else if (tramite.plazoDias === 20) row.p20 += 1;
    else if (tramite.plazoDias === 30) row.p30 += 1;
    else if (tramite.plazoDias === 40) row.p40 += 1;
    else if (tramite.plazoDias === 45) row.p45 += 1;
    else if (tramite.plazoDias === 60) row.p60 += 1;
    else if (tramite.plazoDias === 90) row.p90 += 1;
    else if (tramite.plazoDias === undefined) row.noDefinido += 1;
    row.cargaPonderada += obtenerPesoCargaPorPlazo(tramite.plazoDias);
    if (tramite.estado === 'vencido') row.vencidos += 1;
    if (tramite.estado === 'por_vencer') row.proximos += 1;
  });

  pasadosLegal.forEach((rowPasado) => {
    if (!rows.has(rowPasado.tecnico)) {
      rows.set(rowPasado.tecnico, {
        tecnico: rowPasado.tecnico,
        p3: 0,
        p5: 0,
        p8: 0,
        p10: 0,
        p15: 0,
        p20: 0,
        p30: 0,
        p40: 0,
        p45: 0,
        p60: 0,
        p90: 0,
        noDefinido: 0,
        total: 0,
        pasadosLegal: 0,
        cargaPonderada: 0,
        vencidos: 0,
        proximos: 0,
      });
    }
    rows.get(rowPasado.tecnico)!.pasadosLegal = rowPasado.cantidad;
  });

  return Array.from(rows.values()).sort((a, b) => {
    if (b.cargaPonderada !== a.cargaPonderada) {
      return b.cargaPonderada - a.cargaPonderada;
    }
    if (b.vencidos !== a.vencidos) return b.vencidos - a.vencidos;
    if (b.proximos !== a.proximos) return b.proximos - a.proximos;
    if (b.total !== a.total) return b.total - a.total;
    return a.tecnico.localeCompare(b.tecnico);
  });
}

function obtenerPesoCargaPorPlazo(plazoDias?: number): number {
  if (plazoDias === 3) return 1;
  if (plazoDias === 5) return 1;
  if (plazoDias === 8) return 2;
  if (plazoDias === 10) return 2;
  if (plazoDias === 15) return 3;
  if (plazoDias === 20) return 4;
  if (plazoDias === 30) return 5;
  if (plazoDias === 40) return 6;
  if (plazoDias === 45) return 7;
  if (plazoDias === 60) return 8;
  if (plazoDias === 90) return 9;
  return 0;
}

function construirPasadosLegal(
  tramites: TramiteNormalizado[],
  tecnicoSeleccionado: string
) {
  const grupos = new Map<
    string,
    {
      tecnico: string;
      cantidad: number;
      promedioDias: number;
      maxDias: number;
      tardaronMas: TramiteNormalizado[];
      totalDias: number;
    }
  >();

  tramites
    .filter(
      (tramite) =>
        tramite.fecha_revision_tecnica &&
        tramite.colaboradorTecnico &&
        (tecnicoSeleccionado === 'todos' ||
          tramite.colaboradorTecnico === tecnicoSeleccionado)
    )
    .forEach((tramite) => {
      const tecnico = tramite.colaboradorTecnico!;
      if (!grupos.has(tecnico)) {
        grupos.set(tecnico, {
          tecnico,
          cantidad: 0,
          promedioDias: 0,
          maxDias: 0,
          tardaronMas: [],
          totalDias: 0,
        });
      }
      const row = grupos.get(tecnico)!;
      const dias = tramite.diasEnFaseTecnica ?? tramite.diasTranscurridos ?? 0;
      row.cantidad += 1;
      row.totalDias += dias;
      row.maxDias = Math.max(row.maxDias, dias);
      row.tardaronMas = [...row.tardaronMas, tramite]
        .sort((a, b) => (b.diasEnFaseTecnica || 0) - (a.diasEnFaseTecnica || 0))
        .slice(0, 3);
    });

  return Array.from(grupos.values())
    .map((row) => ({
      ...row,
      promedioDias:
        row.cantidad > 0 ? Math.round((row.totalDias / row.cantidad) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

function obtenerTramitesPasadosLegal(
  tramites: TramiteNormalizado[],
  tecnico: string
): TramiteNormalizado[] {
  return tramites
    .filter(
      (tramite) =>
        tramite.enGestion &&
        tramite.colaboradorTecnico === tecnico &&
        tramitePasadoALegal(tramite)
    )
    .sort(
      (a, b) =>
        (b.fecha_revision_tecnica?.getTime() || 0) -
        (a.fecha_revision_tecnica?.getTime() || 0)
    );
}

function faseTecnicaReconocida(tramite: TramiteNormalizado): boolean {
  return tramite.faseActual === 'tecnica';
}

function tramitePasadoALegal(tramite: TramiteNormalizado): boolean {
  return Boolean(tramite.fecha_revision_tecnica);
}

function calcularControlTecnico(
  tramites: TramiteNormalizado[],
  activosTecnica: TramiteNormalizado[],
  pasadosLegal: ReturnType<typeof construirPasadosLegal>
) {
  const asignadosOriginalmente = tramites.filter(
    (tramite) => tramite.enGestion && Boolean(tramite.colaboradorTecnico)
  );
  const totalPasadosLegal = pasadosLegal.reduce(
    (sum, row) => sum + row.cantidad,
    0
  );
  const excluidosNoReconocidos = asignadosOriginalmente.filter(
    (tramite) =>
      !faseTecnicaReconocida(tramite) &&
      !tramitePasadoALegal(tramite) &&
      !tramite.fechaFinalizacion
  ).length;

  return {
    fasesTecnicas: ['tecnica'],
    criterioPasadoLegal:
      'fecha_revision_tecnica / FECHA REV TECNICA con valor válido',
    totalAsignadosOriginalmente: asignadosOriginalmente.length,
    totalActivosFaseTecnica: activosTecnica.length,
    totalPasadosLegal,
    totalExcluidosFaseNoReconocida: excluidosNoReconocidos,
  };
}

function calcularMargenLegal(tramite: TramiteNormalizado): number | undefined {
  if (tramite.plazoDias === undefined || tramite.diasEnFaseTecnica === undefined) {
    return undefined;
  }
  return tramite.plazoDias - tramite.diasEnFaseTecnica;
}

function clasificarMargenLegal(tramite: TramiteNormalizado) {
  const margen = calcularMargenLegal(tramite);
  if (margen === undefined) return 'Sin dato';
  if (margen < 0) return 'Tarde';
  if (margen === 0) return 'Margen crítico';
  if (margen <= 1) return 'Margen ajustado';
  return 'Margen saludable';
}

function obtenerTramitesLegalActivos(tramites: TramiteNormalizado[]) {
  return tramites.filter(
    (tramite) =>
      tramite.enGestion &&
      !tramite.fechaFinalizacion &&
      tramite.faseActual === 'legal'
  );
}

function calcularCargaLegal(tramites: TramiteNormalizado[]) {
  const grupos = new Map<
    string,
    {
      responsable: string;
      total: number;
      vencidos: number;
      proximos: number;
      requeridos: number;
      margenCritico: number;
    }
  >();

  obtenerTramitesLegalActivos(tramites).forEach((tramite) => {
    const responsable =
      tramite.colaboradorLegal || tramite.personaAsignada || 'Sin asignar legal';
    if (!grupos.has(responsable)) {
      grupos.set(responsable, {
        responsable,
        total: 0,
        vencidos: 0,
        proximos: 0,
        requeridos: 0,
        margenCritico: 0,
      });
    }
    const row = grupos.get(responsable)!;
    row.total += 1;
    if (tramite.estado === 'vencido') row.vencidos += 1;
    if (tramite.estado === 'por_vencer') row.proximos += 1;
    if (tramite.estado === 'requerido') row.requeridos += 1;
    if (['Margen crítico', 'Margen ajustado', 'Tarde'].includes(clasificarMargenLegal(tramite))) {
      row.margenCritico += 1;
    }
  });

  return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
}

function calcularHistoricoTecnico(tramites: TramiteNormalizado[]) {
  const pasadosLegal = tramites.filter(
    (tramite) => tramite.enGestion && tramite.colaboradorTecnico && tramitePasadoALegal(tramite)
  );
  const promedioTecnica =
    pasadosLegal.length > 0
      ? Math.round(
          (pasadosLegal.reduce(
            (sum, tramite) => sum + (tramite.diasEnFaseTecnica ?? 0),
            0
          ) /
            pasadosLegal.length) *
            10
        ) / 10
      : 0;

  return {
    gestionados: tramites.filter((tramite) => tramite.colaboradorTecnico).length,
    pasadosLegal: pasadosLegal.length,
    promedioTecnica,
    margenSaludable: pasadosLegal.filter(
      (tramite) => clasificarMargenLegal(tramite) === 'Margen saludable'
    ).length,
    margenAjustado: pasadosLegal.filter(
      (tramite) => clasificarMargenLegal(tramite) === 'Margen ajustado'
    ).length,
    margenCritico: pasadosLegal.filter(
      (tramite) => clasificarMargenLegal(tramite) === 'Margen crítico'
    ).length,
    tarde: pasadosLegal.filter((tramite) => clasificarMargenLegal(tramite) === 'Tarde').length,
  };
}

function calcularHistoricoLegal(tramites: TramiteNormalizado[]) {
  const legales = tramites.filter(
    (tramite) => tramite.faseActual === 'legal' || Boolean(tramite.colaboradorLegal)
  );
  const promedioLegal =
    legales.length > 0
      ? Math.round(
          (legales.reduce((sum, tramite) => sum + (tramite.diasEnFaseLegal ?? 0), 0) /
            legales.length) *
            10
        ) / 10
      : 0;

  return {
    totalLegal: legales.length,
    aprobados: legales.filter((tramite) => Boolean(tramite.fechaFinalizacion)).length,
    requeridos: legales.filter((tramite) => tramite.estado === 'requerido').length,
    vencidos: legales.filter((tramite) => tramite.estado === 'vencido').length,
    proximos: legales.filter((tramite) => tramite.estado === 'por_vencer').length,
    promedioLegal,
    subsanacion: legales.filter((tramite) =>
      String(tramite.estado_actual || '').toLowerCase().includes('subsan')
    ).length,
  };
}

function TramiteCard({ tramite }: { tramite: TramiteNormalizado }) {
  return (
    <div className="tramite-card tramite-critical">
      <div className="tramite-header">
        <span className={`badge badge-${tramite.estado}`}>
          {tramite.estado.toUpperCase()}
        </span>
        <span className="tramite-id">{tramite.numeroTramite || tramite.id}</span>
      </div>
      <p className="tramite-descripcion">
        {tramite.descripcion || 'Sin descripción'}
      </p>
      <div className="tramite-details">
        <span>Fase: {tramite.faseActual.toUpperCase()}</span>
        <span>{tramite.campoFechaBase || 'Sin fecha identificada'}</span>
        {tramite.diasRestantes !== undefined && (
          <span className="dias-restantes">
            Días restantes: {tramite.diasRestantes}
          </span>
        )}
      </div>
    </div>
  );
}

function TablaTramites({ tramites }: { tramites: TramiteNormalizado[] }) {
  if (tramites.length === 0) {
    return <p className="empty-state">No hay registros para mostrar</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table compact-tramites-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Estado</th>
            <th>Fase</th>
            <th>Fecha base</th>
            <th>Vencimiento</th>
            <th>Técnico</th>
            <th>Legal</th>
          </tr>
        </thead>
        <tbody>
          {tramites.map((tramite, indice) => (
            <tr key={`row-${tramite.id}-${indice}`}>
              <td className="cell-id">{tramite.numeroTramite || tramite.id}</td>
              <td className="cell-descripcion">
                {tramite.descripcion || 'Sin dato'}
              </td>
              <td>
                <span className={`badge badge-${tramite.estado}`}>
                  {tramite.estado}
                </span>
              </td>
              <td>{tramite.faseActual}</td>
              <td>
                {tramite.fechaBase
                  ? tramite.fechaBase.toLocaleDateString('es-HN')
                  : 'Sin fecha identificada'}
              </td>
              <td>
                {tramite.fechaVencimiento
                  ? tramite.fechaVencimiento.toLocaleDateString('es-HN')
                  : 'Sin dato'}
              </td>
              <td
                className="cell-tecnico-code"
                title={tramite.colaboradorTecnico || 'Sin asignar'}
              >
                {obtenerCodigoTecnico(tramite.colaboradorTecnico)}
              </td>
              <td>{tramite.colaboradorLegal || 'Sin asignar'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaTramitesDetallada({ tramites }: { tramites: TramiteNormalizado[] }) {
  if (tramites.length === 0) {
    return <p className="empty-state">No hay registros para mostrar</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table">
        <thead>
          <tr>
            <th>Expediente</th>
            <th>Trámite</th>
            <th>Persona asignada</th>
            <th>Fase actual</th>
            <th>Estado final</th>
            <th>Fecha de inicio</th>
            <th>Fecha probable de salida</th>
            <th>Fecha de finalización</th>
            <th>Días resolución</th>
            <th>Días transcurridos</th>
            <th>Días restantes</th>
            <th>Tiempo fase técnica</th>
            <th>Tiempo fase legal</th>
            <th>Responsable técnico</th>
            <th>Responsable legal</th>
          </tr>
        </thead>
        <tbody>
          {tramites.map((tramite, indice) => (
            <tr key={`detalle-${tramite.id}-${indice}`}>
              <td className="cell-id">{tramite.numeroTramite || tramite.id}</td>
              <td className="cell-descripcion">
                {tramite.descripcion || 'Sin dato'}
              </td>
              <td>{tramite.personaAsignada || 'Sin asignar'}</td>
              <td>{tramite.faseActual}</td>
              <td>{tramite.estado_final || tramite.estado_actual || tramite.estado}</td>
              <td>{formatearFecha(tramite.fecha_inicio_gestion)}</td>
              <td>{formatearFecha(tramite.fechaVencimiento)}</td>
              <td>{formatearFecha(tramite.fechaFinalizacion)}</td>
              <td>{formatearNumero(tramite.plazoDias)}</td>
              <td>{formatearNumero(tramite.diasTranscurridos)}</td>
              <td>{formatearNumero(tramite.diasRestantes)}</td>
              <td>{formatearTrazabilidad(tramite, tramite.diasEnFaseTecnica)}</td>
              <td>{formatearTrazabilidad(tramite, tramite.diasEnFaseLegal)}</td>
              <td
                className="cell-tecnico-code"
                title={tramite.colaboradorTecnico || 'Sin asignar'}
              >
                {obtenerCodigoTecnico(tramite.colaboradorTecnico)}
              </td>
              <td>{tramite.colaboradorLegal || 'Sin asignar'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaCargaPorPersona({ carga }: { carga: CargaColaborador[] }) {
  if (carga.length === 0) {
    return <p className="empty-state">No hay trámites asignados para mostrar</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Trámites asignados</th>
            <th>Total días resolución</th>
            <th>Promedio días resolución</th>
            <th>En técnica</th>
            <th>En legal</th>
            <th>Vencidos</th>
            <th>Próximos a vencer</th>
            <th>Prom. técnica</th>
            <th>Prom. legal</th>
          </tr>
        </thead>
        <tbody>
          {carga.map((item) => (
            <tr key={item.colaborador}>
              <td className="cell-id">{item.colaborador}</td>
              <td>{item.cantidadTramites}</td>
              <td>{item.totalDiasResolucion}</td>
              <td>{formatearNumero(item.promedioDiasResolucion)}</td>
              <td>{item.tramitesEnTecnica}</td>
              <td>{item.tramitesEnLegal}</td>
              <td>{item.tramitesVencidos}</td>
              <td>{item.tramitesProximosAVencer}</td>
              <td>{formatearNumero(item.promedioDiasFaseTecnica)}</td>
              <td>{formatearNumero(item.promedioDiasFaseLegal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaCargaOperativa({ carga }: { carga: CargaColaborador[] }) {
  if (carga.length === 0) {
    return <p className="empty-state">No hay trámites asignados para mostrar</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Rol</th>
            <th>Trámites actuales</th>
            <th>Carga ponderada días</th>
            <th>Promedio plazo</th>
            <th>Plazo 5</th>
            <th>Plazo 10</th>
            <th>Plazo 15</th>
            <th>Plazo mayor</th>
            <th>Cambios hoy</th>
            <th>Vencidos</th>
            <th>Próximos a vencer</th>
          </tr>
        </thead>
        <tbody>
          {carga.map((item) => (
            <tr key={`${item.rol}-${item.colaborador}`}>
              <td className="cell-id">{item.colaborador}</td>
              <td>{item.rol}</td>
              <td>{item.cantidadTramites}</td>
              <td>{item.totalDiasResolucion}</td>
              <td>{formatearNumero(item.promedioDiasResolucion)}</td>
              <td>{item.tramitesPlazo5}</td>
              <td>{item.tramitesPlazo10}</td>
              <td>{item.tramitesPlazo15}</td>
              <td>{item.tramitesPlazoMayor}</td>
              <td>{item.cambiosHoy}</td>
              <td>{item.tramitesVencidos}</td>
              <td>{item.tramitesProximosAVencer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardTecnico({
  tramites,
  tecnicoSeleccionado,
  setTecnicoSeleccionado,
  filtroCondicion,
  setFiltroCondicion,
  filtroDiasResolucion,
  setFiltroDiasResolucion,
  fechaDesde,
  fechaHasta,
  setFechaDesde,
  setFechaHasta,
  aplicarFechas,
  actualizarDatos,
  exportarFiltrados,
  mostrarFiltroFecha = true,
  fechaActualizacion,
}: {
  tramites: TramiteNormalizado[];
  tecnicoSeleccionado: string;
  setTecnicoSeleccionado: (value: string) => void;
  filtroCondicion: FiltroCondicionTecnica;
  setFiltroCondicion: (value: FiltroCondicionTecnica) => void;
  filtroDiasResolucion: FiltroDiasResolucionTecnica;
  setFiltroDiasResolucion: (value: FiltroDiasResolucionTecnica) => void;
  fechaDesde: string;
  fechaHasta: string;
  setFechaDesde: (value: string) => void;
  setFechaHasta: (value: string) => void;
  aplicarFechas: () => void;
  actualizarDatos: () => void;
  exportarFiltrados: (nombre: string, tramites: TramiteNormalizado[]) => void;
  mostrarFiltroFecha?: boolean;
  fechaActualizacion?: Date;
}) {
  const [filtroFase, setFiltroFase] = useState<FiltroFaseTecnica>('todos');
  const [vistaCargaActiva, setVistaCargaActiva] = useState<'dia' | 'tecnico'>(
    'dia'
  );
  const [tramitesSeleccionadosIds, setTramitesSeleccionadosIds] = useState<string[]>(
    []
  );
  const [tramiteReasignacion, setTramiteReasignacion] =
    useState<TramiteNormalizado | null>(null);
  const [modalMasivoAbierto, setModalMasivoAbierto] = useState(false);
  const [menuContextual, setMenuContextual] = useState<ContextMenuState>(null);
  const tramitesTecnicosBase = useMemo(
    () =>
      tramites.filter(
        (t) =>
          t.enGestion &&
          t.colaboradorTecnico &&
          !t.fechaFinalizacion &&
          t.faseActual === 'tecnica'
      ),
    [tramites]
  );
  const tecnicos = useMemo(
    () =>
      Array.from(
        new Set(
          tramitesTecnicosBase
            .map((tramite) => tramite.colaboradorTecnico)
            .filter((tecnico): tecnico is string => Boolean(tecnico))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [tramitesTecnicosBase]
  );
  const tramitesTecnicosFiltrados = useMemo(
    () =>
      tramitesTecnicosBase.filter((tramite) => {
        const cumpleTecnico =
          tecnicoSeleccionado === 'todos' ||
          tramite.colaboradorTecnico === tecnicoSeleccionado;
        const cumpleCondicion =
          filtroCondicion === 'todos' ||
          (filtroCondicion === 'vencido' && tramite.estado === 'vencido') ||
          (filtroCondicion === 'por_vencer' && tramite.estado === 'por_vencer') ||
          (filtroCondicion === 'no_definido' &&
            tramite.plazoDias === undefined) ||
          (filtroCondicion === 'en_tiempo' &&
            tramite.plazoDias !== undefined &&
            tramite.estado !== 'vencido' &&
            tramite.estado !== 'por_vencer');
        const cumpleDias =
          filtroDiasResolucion === 'todos' ||
          (filtroDiasResolucion === 'no_definido' &&
            tramite.plazoDias === undefined) ||
          tramite.plazoDias === Number(filtroDiasResolucion);
        return cumpleTecnico && cumpleCondicion && cumpleDias;
      }),
    [
      filtroCondicion,
      filtroDiasResolucion,
      tecnicoSeleccionado,
      tramitesTecnicosBase,
    ]
  );
  const pasadosLegal = useMemo(
    () => construirPasadosLegal(
      tramites.filter((t) => t.enGestion && Boolean(t.colaboradorTecnico)),
      tecnicoSeleccionado
    ),
    [tecnicoSeleccionado, tramites]
  );
  const pasadosLegalDetalle = useMemo(
    () =>
      tecnicoSeleccionado === 'todos'
        ? tramites.filter(
            (t) =>
              t.enGestion &&
              Boolean(t.colaboradorTecnico) &&
              tramitePasadoALegal(t)
          )
        : obtenerTramitesPasadosLegal(tramites, tecnicoSeleccionado),
    [tecnicoSeleccionado, tramites]
  );
  const pasadosLegalFiltrados = useMemo(
    () =>
      pasadosLegalDetalle.filter((tramite) => {
        const cumpleCondicion =
          filtroCondicion === 'todos' ||
          (filtroCondicion === 'vencido' && tramite.estado === 'vencido') ||
          (filtroCondicion === 'por_vencer' && tramite.estado === 'por_vencer') ||
          (filtroCondicion === 'no_definido' && tramite.plazoDias === undefined) ||
          (filtroCondicion === 'en_tiempo' &&
            tramite.plazoDias !== undefined &&
            tramite.estado !== 'vencido' &&
            tramite.estado !== 'por_vencer');
        const cumpleDias =
          filtroDiasResolucion === 'todos' ||
          (filtroDiasResolucion === 'no_definido' &&
            tramite.plazoDias === undefined) ||
          tramite.plazoDias === Number(filtroDiasResolucion);
        return cumpleCondicion && cumpleDias;
      }),
    [filtroCondicion, filtroDiasResolucion, pasadosLegalDetalle]
  );
  const tramitesVista =
    filtroFase === 'pasado_legal' ? [] : tramitesTecnicosFiltrados;
  const pasadosLegalVista =
    filtroFase === 'tecnica' ? [] : pasadosLegalFiltrados;
  const idsVisibles = useMemo(
    () => new Set(tramitesVista.map((tramite) => tramite.id)),
    [tramitesVista]
  );
  useEffect(() => {
    setTramitesSeleccionadosIds((ids) =>
      ids.filter((id) => idsVisibles.has(id))
    );
  }, [idsVisibles]);
  const tramitesSeleccionados = useMemo(
    () =>
      tramitesVista.filter((tramite) =>
        tramitesSeleccionadosIds.includes(tramite.id)
      ),
    [tramitesSeleccionadosIds, tramitesVista]
  );
  const cargaPorResponsable = useMemo(() => {
    const carga = new Map<string, number>();
    tramitesTecnicosBase.forEach((tramite) => {
      if (!tramite.colaboradorTecnico) return;
      carga.set(
        tramite.colaboradorTecnico,
        (carga.get(tramite.colaboradorTecnico) ?? 0) + 1
      );
    });
    return carga;
  }, [tramitesTecnicosBase]);
  const responsablesDisponibles = tecnicos;
  const pasadosLegalAgrupados = useMemo(
    () => construirPasadosLegal(pasadosLegalVista, 'todos'),
    [pasadosLegalVista]
  );
  const matriz = useMemo(
    () => construirMatrizTecnicos(tramitesVista, pasadosLegalAgrupados),
    [pasadosLegalAgrupados, tramitesVista]
  );
  const resumen = calcularResumenTramitesTecnicos(tramitesVista);
  const tecnicosActivos = matriz.filter((row) => row.total > 0).length;
  const control = useMemo(
    () => calcularControlTecnico(tramites, tramitesTecnicosBase, pasadosLegal),
    [pasadosLegal, tramites, tramitesTecnicosBase]
  ); 
  const abrirMenuContextual = (
    event: MouseEvent<HTMLElement>,
    title: string,
    actions: ContextAction[]
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuContextual({
      x: Math.min(event.clientX, window.innerWidth - 280),
      y: Math.min(event.clientY, window.innerHeight - 240),
      title,
      actions,
    });
  };
  const filtrarPorCondicionAccion = (
    lista: TramiteNormalizado[],
    condicion: FiltroCondicionTecnica
  ) =>
    lista.filter((tramite) => {
      if (condicion === 'vencido') return tramite.estado === 'vencido';
      if (condicion === 'por_vencer') return tramite.estado === 'por_vencer';
      if (condicion === 'no_definido') return tramite.plazoDias === undefined;
      if (condicion === 'en_tiempo') {
        return (
          tramite.plazoDias !== undefined &&
          tramite.estado !== 'vencido' &&
          tramite.estado !== 'por_vencer'
        );
      }
      return true;
    });
  const elegirTecnicoConMasCarga = (lista: TramiteNormalizado[]) => {
    const conteo = new Map<string, number>();
    lista.forEach((tramite) => {
      if (!tramite.colaboradorTecnico) return;
      conteo.set(
        tramite.colaboradorTecnico,
        (conteo.get(tramite.colaboradorTecnico) ?? 0) + 1
      );
    });
    return Array.from(conteo.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const aplicarAccionRedistribucion = ({
    condicion = 'todos',
    tecnico,
    seleccionar = false,
    soloCriticos = false,
  }: {
    condicion?: FiltroCondicionTecnica;
    tecnico?: string;
    seleccionar?: boolean;
    soloCriticos?: boolean;
  }) => {
    const candidatosBase = filtrarPorCondicionAccion(
      tramitesTecnicosBase,
      soloCriticos ? 'vencido' : condicion
    );
    const tecnicoDestino = tecnico ?? elegirTecnicoConMasCarga(candidatosBase);

    setFiltroFase('tecnica');
    setFiltroCondicion(condicion);
    setFiltroDiasResolucion('todos');
    setTecnicoSeleccionado(tecnicoDestino ?? 'todos');

    if (seleccionar && tecnicoDestino) {
      const ids = filtrarPorCondicionAccion(
        tramitesTecnicosBase.filter(
          (tramite) => tramite.colaboradorTecnico === tecnicoDestino
        ),
        soloCriticos ? 'vencido' : condicion
      ).map((tramite) => tramite.id);

      window.setTimeout(() => setTramitesSeleccionadosIds(ids), 0);
    } else {
      setTramitesSeleccionadosIds([]);
    }
  };
  const crearAccionesTecnicas = ({
    condicion = 'todos',
    tecnico,
    incluirCriticos = true,
  }: {
    condicion?: FiltroCondicionTecnica;
    tecnico?: string;
    incluirCriticos?: boolean;
  }): ContextAction[] => [
    {
      label: 'Ver detalle',
      description: 'Muestra el detalle filtrado para revisar carga.',
      action: () => aplicarAccionRedistribucion({ condicion, tecnico }),
    },
    {
      label: 'Redistribuir carga',
      description: 'Prepara seleccion multiple sin ejecutar SOL real.',
      action: () =>
        aplicarAccionRedistribucion({ condicion, tecnico, seleccionar: true }),
    },
    ...(incluirCriticos
      ? [
          {
            label: 'Seleccionar tramites criticos',
            description: 'Preselecciona vencidos del contexto.',
            action: () =>
              aplicarAccionRedistribucion({
                condicion: 'vencido',
                tecnico,
                seleccionar: true,
                soloCriticos: true,
              }),
          },
        ]
      : []),
    {
      label: 'Ver tramites vencidos',
      description: 'Filtra vencidos para este contexto.',
      action: () =>
        aplicarAccionRedistribucion({ condicion: 'vencido', tecnico }),
    },
    {
      label: 'Ver tramites proximos a vencer',
      description: 'Filtra proximos para este contexto.',
      action: () =>
        aplicarAccionRedistribucion({ condicion: 'por_vencer', tecnico }),
    },
    {
      label: 'Limpiar filtro',
      description: 'Vuelve a la vista tecnica general.',
      action: () => {
        setTecnicoSeleccionado('todos');
        setFiltroCondicion('todos');
        setFiltroDiasResolucion('todos');
        setFiltroFase('todos');
        setTramitesSeleccionadosIds([]);
      },
    },
  ];

  return (
    <div className="section technical-dashboard">
      <div className="section-title-row technical-title-row">
        <div>
          <h2>Dashboard técnico</h2>
        <p className="section-subtitle">
          Carga activa, vencimientos y productividad tecnica
        </p>
          {!mostrarFiltroFecha && (
            <div className="live-status">
              <span className="live-badge">Datos en vivo / corte actual</span>
              {fechaActualizacion && (
                <span>
                  Última actualización: {fechaActualizacion.toLocaleString('es-HN')}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() =>
            exportarFiltrados('dashboard-tecnico', [
              ...tramitesVista,
              ...pasadosLegalVista,
            ])
          }
        >
          Exportar vista técnica
        </button>
      </div>

      <div className="custom-range technical-filters">
        {mostrarFiltroFecha && (
          <>
            <label>
              Fecha desde
              <input
                type="date"
                value={fechaDesde}
                onChange={(event) => setFechaDesde(event.target.value)}
              />
            </label>
            <label>
              Fecha hasta
              <input
                type="date"
                value={fechaHasta}
                onChange={(event) => setFechaHasta(event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Técnico
          <select
            value={tecnicoSeleccionado}
            onChange={(event) => setTecnicoSeleccionado(event.target.value)}
          >
            <option value="todos">Todos los técnicos</option>
            {tecnicos.map((tecnico) => (
              <option key={tecnico} value={tecnico}>
                {tecnico}
              </option>
            ))}
          </select>
        </label>
        {tecnicoSeleccionado !== 'todos' && (
          <button
            className="btn btn-outline btn-sm btn-clear-selection"
            onClick={() => setTecnicoSeleccionado('todos')}
            title="Quitar selección y ver todos los técnicos"
          >
            Ver todos
          </button>
        )}
        <label>
          Estado / condición
          <select
            value={filtroCondicion}
            onChange={(event) =>
              setFiltroCondicion(event.target.value as FiltroCondicionTecnica)
            }
          >
            <option value="todos">Todos</option>
            <option value="en_tiempo">En tiempo</option>
            <option value="por_vencer">Próximo a vencer</option>
            <option value="vencido">Vencido</option>
            <option value="no_definido">No definido</option>
          </select>
        </label>
        <label>
          Días de resolución
          <select
            value={filtroDiasResolucion}
            onChange={(event) =>
              setFiltroDiasResolucion(
                event.target.value as FiltroDiasResolucionTecnica
              )
            }
          >
            <option value="todos">Todos</option>
            <option value="5">5 días</option>
            <option value="10">10 días</option>
            <option value="15">15 días</option>
            <option value="20">20 días</option>
            <option value="30">30 días</option>
            <option value="40">40 días</option>
            <option value="no_definido">No definido</option>
          </select>
        </label>
        <label>
          Estado o fase
          <select
            value={filtroFase}
            onChange={(event) =>
              setFiltroFase(event.target.value as FiltroFaseTecnica)
            }
          >
            <option value="todos">Todos</option>
            <option value="tecnica">Activos en técnica</option>
            <option value="pasado_legal">Pasados a legal</option>
          </select>
        </label>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setTecnicoSeleccionado('todos');
            setFiltroCondicion('todos');
            setFiltroDiasResolucion('todos');
            setFiltroFase('todos');
            aplicarFechas();
          }}
        >
          Limpiar filtros
        </button>
        <button className="btn btn-primary btn-sm" onClick={actualizarDatos}>
          Actualizar datos
        </button>
      </div>

      <ResumenTecnico
        resumen={resumen}
        totalPasadosLegal={pasadosLegalVista.length}
        tecnicosActivos={tecnicosActivos}
        crearAcciones={(condicion) => crearAccionesTecnicas({ condicion })}
        abrirMenu={abrirMenuContextual}
      />

      <div className="view-switcher" aria-label="Selector de vista de carga activa">
        <button
          className={`view-switcher-button ${
            vistaCargaActiva === 'dia' ? 'active' : ''
          }`}
          onClick={() => setVistaCargaActiva('dia')}
        >
          Vista por dia de resolucion
        </button>
        <button
          className={`view-switcher-button ${
            vistaCargaActiva === 'tecnico' ? 'active' : ''
          }`}
          onClick={() => setVistaCargaActiva('tecnico')}
        >
          Vista por tecnico
        </button>
      </div>

      <div className="technical-charts">
        {vistaCargaActiva === 'dia' ? (
          <CargaActivaPorDiaResolucion matriz={matriz} />
        ) : (
          <GraficoCargaActivaTecnico
            matriz={matriz}
            abrirMenu={abrirMenuContextual}
            crearAcciones={(tecnico) =>
              crearAccionesTecnicas({ tecnico, condicion: 'todos' })
            }
          />
        )}
        <GraficoDistribucionPlazos tramites={tramitesVista} />
        <GraficoVencidosProximos
          matriz={matriz}
          abrirMenu={abrirMenuContextual}
          crearAcciones={(tecnico) =>
            crearAccionesTecnicas({ tecnico, condicion: 'vencido' })
          }
        />
        <GraficoPasadosLegal rows={pasadosLegalAgrupados} />
      </div>

      <details className="diagnostico-card control-card" open={false}>
        <summary>Diagnóstico de datos</summary>
        <ControlTecnico control={control} />
      </details>

      <h3>Matriz por técnico y días de resolución</h3>
      <TablaMatrizTecnicos
        matriz={matriz}
        tecnicoSeleccionado={tecnicoSeleccionado}
        onSeleccionarTecnico={setTecnicoSeleccionado}
        abrirMenu={abrirMenuContextual}
        crearAcciones={(tecnico) =>
          crearAccionesTecnicas({ tecnico, condicion: 'todos' })
        }
      />

      {tecnicoSeleccionado !== 'todos' && (
        <div className="section detail-panel">
          <div className="section-title-row">
            <div>
              <span className="active-filter-label">
                Filtro activo: {obtenerCodigoTecnico(tecnicoSeleccionado)}
              </span>
              <h2>Detalle del técnico seleccionado: {tecnicoSeleccionado}</h2>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setTecnicoSeleccionado('todos')}
            >
              Volver a la matriz completa
            </button>
          </div>
          <ResumenDetalleTecnico
            tramitesActivos={tramitesVista}
            tramitesPasadosLegal={pasadosLegalVista}
          />
          <details open>
            <summary>Trámites activos en fase técnica ({tramitesVista.length})</summary>
            <div className="redistribution-toolbar">
              <div>
                <span className="redistribution-kicker">Redistribucion de carga</span>
                <p>
                  Selecciona tramites visibles para preparar una reasignacion
                  individual o masiva.
                </p>
              </div>
              <div className="redistribution-actions">
                {tramitesSeleccionados.length > 0 && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setTramitesSeleccionadosIds([])}
                  >
                    Limpiar seleccion
                  </button>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  disabled={tramitesSeleccionados.length === 0}
                  onClick={() => setModalMasivoAbierto(true)}
                >
                  Reasignar {tramitesSeleccionados.length || ''} seleccionados
                </button>
              </div>
            </div>
            <TablaTramitesTecnico
              tramites={tramitesVista}
              tramitesSeleccionadosIds={tramitesSeleccionadosIds}
              onToggleTramite={(id) =>
                setTramitesSeleccionadosIds((ids) =>
                  ids.includes(id)
                    ? ids.filter((item) => item !== id)
                    : [...ids, id]
                )
              }
              onToggleTodos={(ids, seleccionar) =>
                setTramitesSeleccionadosIds((seleccionados) => {
                  if (seleccionar) {
                    return Array.from(new Set([...seleccionados, ...ids]));
                  }
                  return seleccionados.filter((id) => !ids.includes(id));
                })
              }
              onReasignarIndividual={setTramiteReasignacion}
            />
          </details>
          <details>
            <summary>Trámites pasados a legal ({pasadosLegalVista.length})</summary>
            <TablaTramitesPasadosLegal tramites={pasadosLegalVista} />
          </details>
        </div>
      )}

      <h3>Trámites pasados a legal (Resumen por técnico)</h3>
      <TablaPasadosLegal rows={pasadosLegalAgrupados} />

      {tramiteReasignacion && (
        <ModalReasignacionIndividual
          tramite={tramiteReasignacion}
          responsables={responsablesDisponibles}
          cargaPorResponsable={cargaPorResponsable}
          onClose={() => setTramiteReasignacion(null)}
        />
      )}

      {modalMasivoAbierto && (
        <ModalReasignacionMasiva
          tramites={tramitesSeleccionados}
          responsables={responsablesDisponibles}
          cargaPorResponsable={cargaPorResponsable}
          onClose={() => setModalMasivoAbierto(false)}
          onSuccess={() => {
            setModalMasivoAbierto(false);
            setTramitesSeleccionadosIds([]);
          }}
        />
      )}

      <ContextActionMenu
        menu={menuContextual}
        onClose={() => setMenuContextual(null)}
      />
    </div>
  );
}

function TablaCargaTecnicos({ carga }: { carga: CargaColaborador[] }) {
  if (carga.length === 0) {
    return <p className="empty-state">No hay técnicos con trámites asignados</p>;
  }

  const maxCarga = Math.max(...carga.map((item) => item.totalDiasResolucion), 1);

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table carga-tecnica-table">
        <thead>
          <tr>
            <th>Técnico</th>
            <th>Total asignados</th>
            <th>5 días</th>
            <th>10 días</th>
            <th>15 días</th>
            <th>No definido</th>
            <th>Vencidos</th>
            <th>Próximos</th>
            <th>Carga por días</th>
          </tr>
        </thead>
        <tbody>
          {carga.map((item) => (
            <tr key={item.colaborador}>
              <td className="cell-id">{item.colaborador}</td>
              <td>{item.cantidadTramites}</td>
              <td>{item.tramitesPlazo5}</td>
              <td>{item.tramitesPlazo10}</td>
              <td>{item.tramitesPlazo15}</td>
              <td>{item.tramitesPlazoNoDefinido}</td>
              <td>{item.tramitesVencidos}</td>
              <td>{item.tramitesProximosAVencer}</td>
              <td>
                <div className="load-cell">
                  <div className="load-track">
                    <div
                      className="load-bar"
                      style={{
                        width: `${Math.max(
                          4,
                          (item.totalDiasResolucion / maxCarga) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span>{item.totalDiasResolucion}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResumenTecnico({
  resumen,
  totalPasadosLegal,
  tecnicosActivos,
  crearAcciones,
  abrirMenu,
}: {
  resumen: ReturnType<typeof calcularResumenTramitesTecnicos>;
  totalPasadosLegal?: number;
  tecnicosActivos?: number;
  crearAcciones?: (condicion: FiltroCondicionTecnica) => ContextAction[];
  abrirMenu?: (
    event: MouseEvent<HTMLElement>,
    title: string,
    actions: ContextAction[]
  ) => void;
}) {
  const propsAccionables = (
    etiqueta: string,
    condicion: FiltroCondicionTecnica
  ) => {
    const acciones = crearAcciones?.(condicion) ?? [];
    if (!abrirMenu || acciones.length === 0) return {};
    return {
      acciones,
      onOpenActions: (event: MouseEvent<HTMLButtonElement>) =>
        abrirMenu(event, etiqueta, acciones),
      onContextMenuAction: (event: MouseEvent<HTMLDivElement>) =>
        abrirMenu(event, etiqueta, acciones),
    };
  };

  return (
    <div className="summary-grid">
      {tecnicosActivos !== undefined && (
        <MetricCard
          valor={tecnicosActivos}
          etiqueta="Tecnicos activos"
          {...propsAccionables('Tecnicos activos', 'todos')}
        />
      )}
      <MetricCard
        valor={resumen.total}
        etiqueta="Trámites activos en fase técnica"
        {...propsAccionables('Tramites activos', 'todos')}
      />
      {totalPasadosLegal !== undefined && (
        <MetricCard valor={totalPasadosLegal} etiqueta="Pasados a legal" variante="success" />
      )}
      <MetricCard valor={resumen.plazo5} etiqueta="5 dias" />
      <MetricCard valor={resumen.plazo10} etiqueta="10 dias" />
      <MetricCard valor={resumen.plazo15} etiqueta="15 dias" />
      <MetricCard
        valor={resumen.plazoNoDefinido}
        etiqueta="Sin plazo"
        variante="info"
        {...propsAccionables('Sin plazo', 'no_definido')}
      />
      <MetricCard
        valor={resumen.vencidos}
        etiqueta="Vencidos"
        variante="warning"
        {...propsAccionables('Vencidos', 'vencido')}
      />
      <MetricCard
        valor={resumen.proximos}
        etiqueta="Próximos"
        variante="alert"
        {...propsAccionables('Proximos a vencer', 'por_vencer')}
      />
    </div>
  );
}

type ChartItem = {
  key: string;
  value: number;
};

type ThinHorizontalBarChartProps = {
  data: ChartItem[];
  selectedDay?: string | number;
  height?: number;
  valueLabel?: string;
  maxItems?: number;
  colorClassName?: string;
  dayLabel?: string;
};

function ThinHorizontalBarChart({
  data,
  selectedDay,
  height,
  valueLabel = 'tramites',
  maxItems = 12,
  colorClassName = 'thin-bar-blue',
  dayLabel,
}: ThinHorizontalBarChartProps) {
  const sortedData = data
    .filter((item) => item.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.key.localeCompare(b.key);
    });
  const visibleData = sortedData.slice(0, maxItems);
  const hiddenCount = Math.max(0, sortedData.length - visibleData.length);
  const width = 1120;
  const margin = { top: 12, right: 58, bottom: 18, left: 92 };
  const rowHeight = 42;
  const chartHeight =
    height ?? Math.max(118, visibleData.length * rowHeight + margin.top + margin.bottom);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;
  const maxValue = max(visibleData, (item) => item.value) ?? 0;
  const xScale = scaleLinear()
    .domain([0, Math.max(maxValue, 1)])
    .range([0, innerWidth])
    .nice();
  const yScale = scaleBand<string>()
    .domain(visibleData.map((item) => item.key))
    .range([0, innerHeight])
    .padding(0.38);
  const total = sortedData.reduce((sum, item) => sum + item.value, 0);
  const ticks = xScale.ticks(4);
  const gradientId = `bar-gradient-${String(dayLabel || selectedDay || colorClassName)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase()}`;

  if (visibleData.length === 0) {
    return (
      <p className="empty-state thin-empty">
        Sin tecnicos con carga para {selectedDay ?? dayLabel}
      </p>
    );
  }

  return (
    <>
      <svg
        className={`thin-horizontal-chart ${colorClassName}`}
        viewBox={`0 0 ${width} ${chartHeight}`}
        role="img"
        aria-label={`Carga activa ${dayLabel || ''}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="58%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {ticks.map((tick) => (
            <g key={tick} transform={`translate(${xScale(tick)}, 0)`}>
              <line className="thin-grid-line" y1={0} y2={innerHeight} />
              <text className="thin-axis-label" y={innerHeight + 14} textAnchor="middle">
                {tick}
              </text>
            </g>
          ))}

          {visibleData.map((item, index) => {
            const y = yScale(item.key) ?? 0;
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(item.value);
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            const showInsideLabel = barWidth > 54;
            const tooltip = `Tecnico: ${item.key}\nDia de resolucion: ${
              dayLabel || 'No definido'
            }\nCantidad: ${item.value} ${valueLabel}\nPorcentaje: ${formatearPorcentaje(
              percentage
            )}`;

            return (
              <g
                key={item.key}
                className="thin-bar-row"
                style={{ animationDelay: `${index * 28}ms` }}
              >
                <title>{tooltip}</title>
                <text
                  className="thin-y-label"
                  x={-14}
                  y={y + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {obtenerCodigoTecnico(item.key)}
                </text>
                <rect
                  className="thin-bar-bg"
                  x={0}
                  y={y}
                  width={innerWidth}
                  height={barHeight}
                  rx={barHeight / 2}
                />
                <rect
                  className="thin-bar-fill"
                  x={0}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={barHeight / 2}
                  fill={`url(#${gradientId})`}
                />
                {showInsideLabel && (
                  <text
                    className="thin-inside-value"
                    x={Math.max(18, barWidth - 10)}
                    y={y + barHeight / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {item.value}
                  </text>
                )}
                {!showInsideLabel && (
                  <text
                    className="thin-outside-value"
                    x={Math.min(innerWidth, barWidth + 8)}
                    y={y + barHeight / 2}
                    dominantBaseline="middle"
                  >
                    {item.value}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {hiddenCount > 0 && (
        <p className="thin-more">+ {hiddenCount} tecnicos mas con carga</p>
      )}
    </>
  );
}

type MetricBarItem = {
  name: string;
  shortName?: string;
  value: number;
  total?: number;
  detail?: string;
};

type MetricDonutItem = {
  name: string;
  value: number;
  color: string;
};

function MetricTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;

  return (
    <div className="recharts-tooltip-card">
      <strong>{item?.detail || label || item?.name}</strong>
      {payload.map((entry: any) => (
        <span key={entry.dataKey || entry.name}>
          {entry.name || 'Valor'}: {entry.value?.toLocaleString?.('es-HN') ?? entry.value}
        </span>
      ))}
      {item?.total !== undefined && <span>Total activo: {item.total}</span>}
    </div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  const total = payload[0]?.payload?.total || 0;
  const porcentaje = total > 0 ? (item.value / total) * 100 : 0;

  return (
    <div className="recharts-tooltip-card">
      <strong>{item.name}</strong>
      <span>{item.value} trámites</span>
      <span>{formatearPorcentaje(porcentaje)}</span>
    </div>
  );
}

function MetricBarChart({
  data,
  valueLabel = 'Carga ponderada',
  height = 360,
}: {
  data: MetricBarItem[];
  valueLabel?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="empty-state">Sin datos para graficar</p>;
  }

  return (
    <div className="recharts-panel" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 12, right: 28, bottom: 12, left: 0 }}
          barCategoryGap={14}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="recharts-grid" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="shortName"
            width={64}
            tickLine={false}
            axisLine={false}
            className="recharts-axis"
          />
          <Tooltip content={<MetricTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }} />
          <Bar
            dataKey="value"
            name={valueLabel}
            radius={[0, 8, 8, 0]}
            fill="url(#metricBarBlue)"
            barSize={18}
          >
            <defs>
              <linearGradient id="metricBarBlue" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            <LabelList dataKey="value" position="right" className="recharts-value-label" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricDonutChart({
  data,
  total,
}: {
  data: MetricDonutItem[];
  total: number;
}) {
  const chartData = data
    .filter((item) => item.value > 0)
    .map((item) => ({ ...item, total }));

  if (chartData.length === 0) {
    return <p className="empty-state">Sin trámites para graficar</p>;
  }

  return (
    <div className="metric-donut-layout">
      <div className="metric-donut-chart">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={74}
              outerRadius={104}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="metric-donut-center">
          <strong>{total}</strong>
          <span>total</span>
        </div>
      </div>
      <div className="metric-donut-legend">
        {chartData.map((item) => {
          const porcentaje = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.name} className="metric-donut-legend-row">
              <span className="legend-dot" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
              <strong>{item.value}</strong>
              <small>{formatearPorcentaje(porcentaje)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CargaActivaPorDiaResolucion({
  matriz,
}: {
  matriz: ReturnType<typeof construirMatrizTecnicos>;
}) {
  const [diaSeleccionado, setDiaSeleccionado] = useState<SeriePlazoResolucion>(
    SERIES_PLAZOS_RESOLUCION[0].key
  );
  const dataPorDia = SERIES_PLAZOS_RESOLUCION.map((serie) => {
    const tecnicos = matriz
      .map((row) => ({
        key: row.tecnico,
        value: row[serie.key] as number,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return a.key.localeCompare(b.key);
      });
    const total = tecnicos.reduce((sum, item) => sum + item.value, 0);

    return {
      dia: serie.label,
      key: serie.key,
      total,
      tecnicos,
      colorClassName: serie.className,
    };
  });
  const totalGeneral = dataPorDia.reduce((sum, item) => sum + item.total, 0);
  const grupoSeleccionado =
    dataPorDia.find((grupo) => grupo.key === diaSeleccionado) ?? dataPorDia[0];

  return (
    <div className="chart-card chart-card-wide day-resolution-panel">
      <div className="chart-card-header">
        <div>
          <h3>Carga activa por dia de resolucion</h3>
          <p>Graficos horizontales por plazo exacto, ordenados por carga.</p>
        </div>
        <div className="chart-stat">
          <strong>{totalGeneral}</strong>
          <span>activos</span>
        </div>
      </div>

      <div className="day-summary-grid">
        {dataPorDia.map((grupo) => (
          <button
            key={grupo.dia}
            className={`day-summary-card ${grupo.colorClassName} ${
              grupo.key === grupoSeleccionado.key ? 'selected' : ''
            }`}
            onClick={() => setDiaSeleccionado(grupo.key)}
            type="button"
          >
            <span className="day-summary-dot" />
            <strong>{grupo.dia}</strong>
            <span>{grupo.total} tramites</span>
            <small>{grupo.tecnicos.length} tecnicos</small>
          </button>
        ))}
      </div>

      <div className={`day-main-chart ${grupoSeleccionado.colorClassName}`}>
        <div className="day-main-chart-header">
          <div>
            <h4>Carga activa - {grupoSeleccionado.dia}</h4>
            <p>Tecnicos ordenados por mayor carga</p>
          </div>
          <div className="day-main-chart-total">
            <strong>{grupoSeleccionado.total}</strong>
            <span>tramites</span>
          </div>
        </div>
        <ThinHorizontalBarChart
          data={grupoSeleccionado.tecnicos}
          selectedDay={grupoSeleccionado.dia}
          valueLabel="tramites"
          maxItems={14}
          colorClassName={grupoSeleccionado.colorClassName}
          dayLabel={grupoSeleccionado.dia}
        />
      </div>
    </div>
  );
}

function GraficoCargaActivaTecnico({
  matriz,
  abrirMenu,
  crearAcciones,
}: {
  matriz: ReturnType<typeof construirMatrizTecnicos>;
  abrirMenu?: (
    event: MouseEvent<HTMLElement>,
    title: string,
    actions: ContextAction[]
  ) => void;
  crearAcciones?: (tecnico: string) => ContextAction[];
}) {
  const rows = matriz
    .filter((row) => row.total > 0)
    .sort((a, b) => {
      if (b.cargaPonderada !== a.cargaPonderada) {
        return b.cargaPonderada - a.cargaPonderada;
      }
      return b.total - a.total;
    })
    .slice(0, 12);
  const totalActivo = rows.reduce((sum, row) => sum + row.total, 0);
  const chartData: MetricBarItem[] = rows.map((row) => ({
    name: row.tecnico,
    shortName: obtenerCodigoTecnico(row.tecnico),
    value: row.cargaPonderada,
    total: row.total,
    detail: row.tecnico,
  }));

  if (rows.length === 0) {
    return (
      <div className="chart-card">
        <h3>Carga activa por tecnico</h3>
        <p className="empty-state">Sin carga activa para graficar</p>
      </div>
    );
  }

  return (
    <div className="chart-card chart-card-wide active-load-card">
      <div className="chart-card-header">
        <div>
          <h3>Carga activa por tecnico</h3>
          <p>Barras Recharts ordenadas por carga ponderada.</p>
        </div>
        <div className="chart-stat">
          <strong>{totalActivo}</strong>
          <span>activos</span>
        </div>
      </div>
      <MetricBarChart data={chartData} height={Math.max(280, rows.length * 38 + 72)} />
      {abrirMenu && crearAcciones && (
        <div className="chart-context-strip" aria-label="Accesos de redistribucion por tecnico">
          {rows.slice(0, 8).map((row) => {
            const acciones = crearAcciones(row.tecnico);
            return (
              <button
                key={`chart-action-${row.tecnico}`}
                type="button"
                onClick={(event) =>
                  abrirMenu(event, obtenerCodigoTecnico(row.tecnico), acciones)
                }
                onContextMenu={(event) =>
                  abrirMenu(event, obtenerCodigoTecnico(row.tecnico), acciones)
                }
                title={row.tecnico}
              >
                <span>{obtenerCodigoTecnico(row.tecnico)}</span>
                <strong>{row.total}</strong>
              </button>
            );
          })}
        </div>
      )}
      <div className="legacy-chart-hidden">
        {rows.map((row) => (
          <div className="stacked-row" key={row.tecnico}>
            <span className="stacked-label" title={row.tecnico}>
              {obtenerCodigoTecnico(row.tecnico)}
            </span>
            <div
              className="stacked-track"
              aria-label={`${row.total} tramites tecnicos activos`}
            >
              {SERIES_PLAZOS_RESOLUCION.map((serie) => {
                const value = row[serie.key] as number;
                if (value === 0) return null;

                const porcentaje = (value / row.total) * 100;
                const tooltip = `${row.tecnico}\n${serie.label}: ${value} tramites\nPorcentaje: ${formatearPorcentaje(
                  porcentaje
                )}`;
                const mostrarTexto = porcentaje >= 13;

                return (
                  <span
                    key={serie.key}
                    className={`stacked-segment compact-segment ${serie.className}`}
                    style={{
                      width: `${porcentaje}%`,
                      backgroundColor: serie.color,
                    }}
                    title={tooltip}
                    aria-label={`${row.tecnico} - ${tooltip}`}
                  >
                    {mostrarTexto && <span className="segment-value">{value}</span>}
                    <span className="segment-label">{serie.label.replace(' días', 'd')}</span>
                  </span>
                );
              })}
            </div>
            <strong className="stacked-total">{row.total}</strong>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        {SERIES_PLAZOS_RESOLUCION.map((serie) => (
          <span
            key={serie.key}
            className="legend-item legend-plazo"
            style={{ '--legend-color': serie.color } as CSSProperties}
          >
            {serie.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GraficoDistribucionPlazos({
  tramites,
}: {
  tramites: TramiteNormalizado[];
}) {
  const segmentos = SERIES_PLAZOS_RESOLUCION.map((serie) => ({
    ...serie,
    value: tramites.filter((t) =>
      serie.plazo === undefined ? t.plazoDias === undefined : t.plazoDias === serie.plazo
    ).length,
  }));
  const total = segmentos.reduce((sum, item) => sum + item.value, 0);
  let acumulado = 0;
  const donutData: MetricDonutItem[] = segmentos.map((segmento) => ({
    name: segmento.label,
    value: segmento.value,
    color: segmento.color,
  }));

  return (
    <div className="chart-card doughnut-card">
      <div className="chart-card-header">
        <div>
          <h3>Distribucion por dias de resolucion</h3>
          <p>Participacion de cada plazo dentro de la carga tecnica filtrada.</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="empty-state">Sin tramites para graficar</p>
      ) : (
        <>
        <MetricDonutChart data={donutData} total={total} />
        <div className="legacy-chart-hidden doughnut-layout">
          <svg className="doughnut-chart" viewBox="0 0 42 42" role="img">
            <circle className="doughnut-ring" cx="21" cy="21" r="15.915" />
            {segmentos.map((segmento) => {
              const porcentaje = (segmento.value / total) * 100;
              const dash = `${porcentaje} ${100 - porcentaje}`;
              const offset = 25 - acumulado;
              const tooltip = `${segmento.label}: ${
                segmento.value
              } tramites (${formatearPorcentaje(porcentaje)})`;
              acumulado += porcentaje;
              return segmento.value > 0 ? (
                <circle
                  key={segmento.label}
                  className="doughnut-slice"
                  cx="21"
                  cy="21"
                  r="15.915"
                  stroke={segmento.color}
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  aria-label={tooltip}
                >
                  <title>{tooltip}</title>
                </circle>
              ) : null;
            })}
            <text x="21" y="20" textAnchor="middle" className="doughnut-total">
              {total}
            </text>
            <text x="21" y="24" textAnchor="middle" className="doughnut-caption">
              total
            </text>
          </svg>
          <div className="doughnut-legend">
            {segmentos.map((segmento) => {
              const porcentaje = total > 0 ? (segmento.value / total) * 100 : 0;

              return (
              <span
                key={segmento.label}
                title={`${segmento.label}: ${
                  segmento.value
                } tramites (${formatearPorcentaje(porcentaje)})`}
              >
                <i style={{ backgroundColor: segmento.color }} />
                {segmento.label}: {segmento.value} ({formatearPorcentaje(porcentaje)})
              </span>
              );
            })}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function GraficoVencidosProximos({
  matriz,
  abrirMenu,
  crearAcciones,
}: {
  matriz: ReturnType<typeof construirMatrizTecnicos>;
  abrirMenu?: (
    event: MouseEvent<HTMLElement>,
    title: string,
    actions: ContextAction[]
  ) => void;
  crearAcciones?: (tecnico: string) => ContextAction[];
}) {
  const rows = matriz
    .filter((row) => row.vencidos > 0 || row.proximos > 0)
    .sort((a, b) => b.vencidos + b.proximos - (a.vencidos + a.proximos))
    .slice(0, 10);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <h3>Alertas operativas por tecnico</h3>
          <p>
            Identifica tecnicos con carga proxima a vencer o con mayor
            concentracion en plazos altos.
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty-state">Sin alertas segun los filtros actuales.</p>
      ) : (
        <div className="grouped-bars">
          {rows.map((row) => {
            const max = Math.max(...rows.map((item) => item.vencidos + item.proximos), 1);
            const acciones = crearAcciones?.(row.tecnico) ?? [];
            return (
              <div
                className="grouped-row grouped-row-actionable"
                key={row.tecnico}
                onContextMenu={(event) =>
                  abrirMenu?.(event, obtenerCodigoTecnico(row.tecnico), acciones)
                }
              >
                <span title={row.tecnico}>{obtenerCodigoTecnico(row.tecnico)}</span>
                <div className="grouped-track">
                  <i
                    className="grouped-bar grouped-vencido"
                    style={{ width: `${(row.vencidos / max) * 100}%` }}
                    title={`Vencidos: ${row.vencidos}`}
                  />
                  <i
                    className="grouped-bar grouped-proximo"
                    style={{ width: `${(row.proximos / max) * 100}%` }}
                    title={`Proximos: ${row.proximos}`}
                  />
                </div>
                <strong>{row.vencidos + row.proximos}</strong>
                {abrirMenu && acciones.length > 0 && (
                  <button
                    className="inline-context-button"
                    type="button"
                    onClick={(event) =>
                      abrirMenu(event, obtenerCodigoTecnico(row.tecnico), acciones)
                    }
                    aria-label={`Acciones de ${obtenerCodigoTecnico(row.tecnico)}`}
                  >
                    ⋮
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GraficoPasadosLegal({
  rows,
}: {
  rows: ReturnType<typeof construirPasadosLegal>;
}) {
  const ordenados = rows.slice(0, 10);
  const max = Math.max(...ordenados.map((row) => row.cantidad), 1);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <h3>Pasados a legal por tecnico</h3>
          <p>Salida de tramites desde fase tecnica hacia legal.</p>
        </div>
      </div>
      {ordenados.length === 0 ? (
        <p className="empty-state">Sin pases a legal para mostrar</p>
      ) : (
        <div className="simple-bars">
          {ordenados.map((row) => (
            <div className="simple-bar-row" key={row.tecnico}>
              <span title={row.tecnico}>{obtenerCodigoTecnico(row.tecnico)}</span>
              <div className="simple-bar-track">
                <i style={{ width: `${(row.cantidad / max) * 100}%` }} />
              </div>
              <strong>{row.cantidad}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenDetalleTecnico({
  tramitesActivos,
  tramitesPasadosLegal,
}: {
  tramitesActivos: TramiteNormalizado[];
  tramitesPasadosLegal: TramiteNormalizado[];
}) {
  const vencidos = tramitesActivos.filter((t) => t.estado === 'vencido').length;
  const proximos = tramitesActivos.filter((t) => t.estado === 'por_vencer').length;
  const noDefinidos = tramitesActivos.filter((t) => t.plazoDias === undefined).length;
  const cargaPonderada = tramitesActivos.reduce(
    (sum, tramite) => sum + obtenerPesoCargaPorPlazo(tramite.plazoDias),
    0
  );

  return (
    <div className="summary-grid detail-summary">
      <MetricCard valor={tramitesActivos.length} etiqueta="Activos" />
      <MetricCard valor={vencidos} etiqueta="Vencidos" variante="warning" />
      <MetricCard valor={proximos} etiqueta="Proximos" variante="alert" />
      <MetricCard
        valor={Math.max(tramitesActivos.length - vencidos - proximos - noDefinidos, 0)}
        etiqueta="En tiempo"
      />
      <MetricCard valor={noDefinidos} etiqueta="No definido" />
      <MetricCard valor={tramitesPasadosLegal.length} etiqueta="Pasados a legal" variante="success" />
      <MetricCard valor={cargaPonderada} etiqueta="Carga ponderada" />
    </div>
  );
}

function ControlTecnico({
  control,
}: {
  control: ReturnType<typeof calcularControlTecnico>;
}) {
  return (
    <div className="diagnostico-card control-card">
      <h3>Control de separación técnica/legal</h3>
      <div className="control-grid">
        <span>Fase actual considerada técnica</span>
        <strong>{control.fasesTecnicas.join(', ')}</strong>
        <span>Criterio para “pasado a legal”</span>
        <strong>{control.criterioPasadoLegal}</strong>
        <span>Total asignados originalmente</span>
        <strong>{control.totalAsignadosOriginalmente}</strong>
        <span>Total activos en fase técnica</span>
        <strong>{control.totalActivosFaseTecnica}</strong>
        <span>Total pasados a legal</span>
        <strong>{control.totalPasadosLegal}</strong>
        <span>Excluidos por fase no reconocida</span>
        <strong>{control.totalExcluidosFaseNoReconocida}</strong>
      </div>
    </div>
  );
}

function TablaMatrizTecnicos({
  matriz,
  tecnicoSeleccionado,
  onSeleccionarTecnico,
  abrirMenu,
  crearAcciones,
}: {
  matriz: ReturnType<typeof construirMatrizTecnicos>;
  tecnicoSeleccionado: string;
  onSeleccionarTecnico: (tecnico: string) => void;
  abrirMenu?: (
    event: MouseEvent<HTMLElement>,
    title: string,
    actions: ContextAction[]
  ) => void;
  crearAcciones?: (tecnico: string) => ContextAction[];
}) {
  if (matriz.length === 0) {
    return <p className="empty-state">No hay técnicos con trámites asignados</p>;
  }

  const maxCarga = Math.max(...matriz.map((row) => row.cargaPonderada), 1);
  const maxTotal = Math.max(...matriz.map((row) => row.total), 1);
  const renderValorConBarra = (valor: number) => (
    <div className="table-bar-cell">
      <span>{valor}</span>
      <div className="table-bar-track">
        <i
          style={{
            width: `${valor > 0 ? Math.max(6, (valor / maxTotal) * 100) : 0}%`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table technical-matrix">
        <thead>
          <tr>
            <th>Técnico</th>
            <th>3 días</th>
            <th>5 días</th>
            <th>8 días</th>
            <th>10 días</th>
            <th>15 días</th>
            <th>20 días</th>
            <th>30 días</th>
            <th>40 días</th>
            <th>45 días</th>
            <th>60 días</th>
            <th>90 días</th>
            <th>No definido</th>
            <th>Total activo</th>
            <th>% carga</th>
            <th>Pasados a legal</th>
            <th>Carga ponderada</th>
            {abrirMenu && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {matriz.map((row) => {
            const acciones = crearAcciones?.(row.tecnico) ?? [];
            return (
              <tr
                key={row.tecnico}
                className={`matrix-row-clickable ${
                  row.tecnico === tecnicoSeleccionado ? 'row-selected' : ''
                }`}
                onClick={() => onSeleccionarTecnico(row.tecnico)}
                onContextMenu={(event) =>
                  abrirMenu?.(event, obtenerCodigoTecnico(row.tecnico), acciones)
                }
              >
              <td className="cell-id" title={row.tecnico}>
                {obtenerCodigoTecnico(row.tecnico)}
              </td>
              <td>{renderValorConBarra(row.p3)}</td>
              <td>{renderValorConBarra(row.p5)}</td>
              <td>{renderValorConBarra(row.p8)}</td>
              <td>{renderValorConBarra(row.p10)}</td>
              <td>{renderValorConBarra(row.p15)}</td>
              <td>{renderValorConBarra(row.p20)}</td>
              <td>{renderValorConBarra(row.p30)}</td>
              <td>{renderValorConBarra(row.p40)}</td>
              <td>{renderValorConBarra(row.p45)}</td>
              <td>{renderValorConBarra(row.p60)}</td>
              <td>{renderValorConBarra(row.p90)}</td>
              <td>{renderValorConBarra(row.noDefinido)}</td>
              <td>{renderValorConBarra(row.total)}</td>
              <td>{formatearPorcentaje((row.total / maxTotal) * 100)}</td>
              <td>{row.pasadosLegal}</td>
              <td>
                <div className="load-cell">
                  <div className="load-track">
                    <div
                      className="load-bar"
                      style={{
                        width: `${Math.max(4, (row.cargaPonderada / maxCarga) * 100)}%`,
                      }}
                    />
                  </div>
                  <span>{row.cargaPonderada}</span>
                </div>
              </td>
              {abrirMenu && (
                <td>
                  <button
                    className="inline-context-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      abrirMenu(event, obtenerCodigoTecnico(row.tecnico), acciones);
                    }}
                    aria-label={`Acciones de ${obtenerCodigoTecnico(row.tecnico)}`}
                  >
                    ⋮
                  </button>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaPasadosLegal({
  rows,
}: {
  rows: ReturnType<typeof construirPasadosLegal>;
}) {
  if (rows.length === 0) {
    return <p className="empty-state">No hay pases a legal en el periodo</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table">
        <thead>
          <tr>
            <th>Técnico</th>
            <th>Enviados a legal</th>
            <th>Promedio días antes de legal</th>
            <th>Trámites que más tardaron</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tecnico}>
              <td className="cell-id" title={row.tecnico}>
                {obtenerCodigoTecnico(row.tecnico)}
              </td>
              <td>{row.cantidad}</td>
              <td>{row.promedioDias}</td>
              <td>
                {row.tardaronMas
                  .map(
                    (tramite) =>
                      `${tramite.numeroTramite || tramite.id} (${formatearNumero(
                        tramite.diasEnFaseTecnica
                      )} días)`
                  )
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaTramitesTecnico({
  tramites,
  tramitesSeleccionadosIds = [],
  onToggleTramite,
  onToggleTodos,
  onReasignarIndividual,
}: {
  tramites: TramiteNormalizado[];
  tramitesSeleccionadosIds?: string[];
  onToggleTramite?: (id: string) => void;
  onToggleTodos?: (ids: string[], seleccionar: boolean) => void;
  onReasignarIndividual?: (tramite: TramiteNormalizado) => void;
}) {
  if (tramites.length === 0) {
    return <p className="empty-state">No hay trámites para este técnico</p>;
  }

  const ordenados = [...tramites].sort((a, b) => {
    const prioridad = (tramite: TramiteNormalizado) =>
      tramite.estado === 'vencido' ? 3 : tramite.estado === 'por_vencer' ? 2 : 1;
    if (prioridad(b) !== prioridad(a)) return prioridad(b) - prioridad(a);
    return (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999);
  });
  const idsOrdenados = ordenados.map((tramite) => tramite.id);
  const todosSeleccionados =
    idsOrdenados.length > 0 &&
    idsOrdenados.every((id) => tramitesSeleccionadosIds.includes(id));
  const puedeSeleccionar = Boolean(onToggleTramite && onToggleTodos);

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table">
        <thead>
          <tr>
            {puedeSeleccionar && (
              <th className="selection-cell">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={(event) =>
                    onToggleTodos?.(idsOrdenados, event.target.checked)
                  }
                  aria-label="Seleccionar todos los tramites visibles"
                />
              </th>
            )}
            <th>Expediente</th>
            <th>Trámite</th>
            <th>Técnico asignado</th>
            <th>Estado actual</th>
            <th>Fase actual</th>
            <th>Fecha de inicio</th>
            <th>Fecha probable de salida</th>
            <th>Días resolución</th>
            <th>Días transcurridos</th>
            <th>Días restantes</th>
            <th>Condición</th>
            <th>Pasó a legal</th>
            <th>Fecha pase a legal</th>
            <th>Entrada técnica</th>
            <th>Salida técnica</th>
            <th>Días fase técnica</th>
            {onReasignarIndividual && <th>Redistribución</th>}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((tramite) => (
            <tr
              key={tramite.id}
              className={
                tramitesSeleccionadosIds.includes(tramite.id)
                  ? 'row-selected redistribution-row-selected'
                  : undefined
              }
            >
              {puedeSeleccionar && (
                <td className="selection-cell">
                  <input
                    type="checkbox"
                    checked={tramitesSeleccionadosIds.includes(tramite.id)}
                    onChange={() => onToggleTramite?.(tramite.id)}
                    aria-label={`Seleccionar tramite ${
                      tramite.numeroTramite || tramite.id
                    }`}
                  />
                </td>
              )}
              <td className="cell-id">{tramite.numeroTramite || tramite.id}</td>
              <td
                className="cell-tramite-code"
                title={tramite.descripcion || tramite.tipo_tramite || 'Sin dato'}
              >
                {obtenerNomenclaturaTramite(tramite)}
              </td>
              <td
                className="cell-tecnico-code"
                title={tramite.colaboradorTecnico || 'Sin asignar'}
              >
                {obtenerCodigoTecnico(tramite.colaboradorTecnico)}
              </td>
              <td>{tramite.estado_actual || tramite.estado}</td>
              <td>{tramite.faseActual}</td>
              <td>{formatearFecha(tramite.fecha_inicio_gestion)}</td>
              <td>{formatearFecha(tramite.fechaVencimiento)}</td>
              <td>{formatearNumero(tramite.plazoDias)}</td>
              <td>{formatearNumero(tramite.diasTranscurridos)}</td>
              <td>{formatearNumero(tramite.diasRestantes)}</td>
              <td>
                <span className={`badge badge-${tramite.estado}`}>
                  {obtenerCondicion(tramite)}
                </span>
              </td>
              <td>{tramite.fecha_revision_tecnica ? 'Sí' : 'No'}</td>
              <td>{formatearFecha(tramite.fecha_revision_tecnica)}</td>
              <td>{formatearFecha(tramite.fecha_inicio_gestion)}</td>
              <td>{formatearFecha(tramite.fecha_revision_tecnica)}</td>
              <td>{formatearTrazabilidad(tramite, tramite.diasEnFaseTecnica)}</td>
              {onReasignarIndividual && (
                <td>
                  <button
                    className="btn btn-outline btn-xs redistribution-row-action"
                    onClick={() => onReasignarIndividual(tramite)}
                  >
                    Reasignar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModalReasignacionIndividual({
  tramite,
  responsables,
  cargaPorResponsable,
  onClose,
}: {
  tramite: TramiteNormalizado;
  responsables: string[];
  cargaPorResponsable: Map<string, number>;
  onClose: () => void;
}) {
  const [nuevoResponsable, setNuevoResponsable] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const responsableActual = tramite.colaboradorTecnico || tramite.personaAsignada || '';
  const responsablesDestino = responsables.filter(Boolean);
  const cargaActualOrigen = responsableActual
    ? cargaPorResponsable.get(responsableActual) ?? 0
    : undefined;
  const cargaActualDestino = nuevoResponsable
    ? cargaPorResponsable.get(nuevoResponsable) ?? 0
    : undefined;

  const confirmar = async () => {
    if (!nuevoResponsable) {
      setMensaje('Seleccione un nuevo responsable.');
      return;
    }
    if (nuevoResponsable === responsableActual) {
      setMensaje('El nuevo responsable no puede ser igual al responsable actual.');
      return;
    }
    if (!motivo.trim()) {
      setMensaje('Ingrese el motivo de la redistribucion.');
      return;
    }
    const codigoTramite = obtenerCodigoInternoTramite(tramite);
    if (codigoTramite === undefined) {
      setMensaje('No se encontro el codigo interno numerico del tramite requerido por SOL.');
      return;
    }
    const codigoResponsable = obtenerCodigoResponsable(nuevoResponsable);
    if (codigoResponsable === undefined) {
      setMensaje('No se pudo resolver el codigo numerico del nuevo responsable.');
      return;
    }
    const resumen = `Vas a reasignar el tramite ${
      tramite.numeroTramite || tramite.id
    } de ${responsableActual || 'Sin responsable'} hacia ${nuevoResponsable}.`;
    if (!window.confirm(resumen)) return;

    setProcesando(true);
    try {
      const resultado = await reasignarTramite({
        codigo: codigoTramite,
        responsable: codigoResponsable,
        nota: comentario.trim() || motivo.trim(),
      });
      setMensaje(resultado.mensaje);
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? `No se pudo enviar la reasignacion al backend seguro. ${error.message}`
          : 'No se pudo enviar la reasignacion al backend seguro.'
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="redistribution-modal-backdrop" role="presentation">
      <div className="redistribution-modal" role="dialog" aria-modal="true">
        <div className="redistribution-modal-header">
          <div>
            <span className="redistribution-kicker">Redistribucion de carga</span>
            <h3>Reasignar tramite</h3>
          </div>
          <button className="modal-close-button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="redistribution-summary-card">
          <span>Expediente</span>
          <strong>{tramite.numeroTramite || tramite.id}</strong>
          <span>Tramite</span>
          <strong>{tramite.descripcion || tramite.tipo_tramite || obtenerNomenclaturaTramite(tramite)}</strong>
          <span>Responsable actual</span>
          <strong>{responsableActual || 'Sin responsable identificado'}</strong>
        </div>

        <div className="redistribution-form-grid">
          <label>
            Nuevo responsable
            <select
              value={nuevoResponsable}
              onChange={(event) => setNuevoResponsable(event.target.value)}
            >
              <option value="">Seleccione responsable</option>
              {responsablesDestino.map((responsable) => (
                <option key={responsable} value={responsable}>
                  {obtenerCodigoTecnico(responsable)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo de redistribucion
            <input
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Balanceo operativo de carga"
            />
          </label>
          <label className="redistribution-full-field">
            Comentario opcional
            <textarea
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
              rows={3}
              placeholder="Contexto adicional para bitacora futura"
            />
          </label>
        </div>

        <ImpactoRedistribucion
          responsableActual={responsableActual}
          nuevoResponsable={nuevoResponsable}
          cantidad={1}
          cargaActualOrigen={cargaActualOrigen}
          cargaActualDestino={cargaActualDestino}
        />

        {mensaje && <p className="redistribution-message">{mensaje}</p>}

        <div className="redistribution-modal-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={confirmar}
            disabled={procesando}
          >
            {procesando ? 'Preparando...' : 'Confirmar reasignacion'}
          </button>
        </div>
      </div>
    </div>
  );
}

function obtenerCodigoInternoTramite(tramite: TramiteNormalizado): number | undefined {
  const campos = tramite as unknown as Record<string, unknown>;
  const candidatos = [
    campos.codigoInterno,
    campos.codigo_tramite,
    campos.codigoTramite,
    campos.codigo,
    campos.Codigo,
    campos.CodigoTramite,
    tramite.id_tramite,
    tramite.id,
  ];

  for (const candidato of candidatos) {
    const texto = String(candidato || '').trim();
    if (/^\d+$/.test(texto)) {
      return Number(texto);
    }
  }

  return undefined;
}

function obtenerCodigoResponsable(responsable: string): number | undefined {
  const match = responsable.match(/\b\d+\b/);
  return match ? Number(match[0]) : undefined;
}

function ModalReasignacionMasiva({
  tramites,
  responsables,
  cargaPorResponsable,
  onClose,
  onSuccess,
}: {
  tramites: TramiteNormalizado[];
  responsables: string[];
  cargaPorResponsable: Map<string, number>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nuevoResponsable, setNuevoResponsable] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const responsablesOrigen = Array.from(
    new Set(tramites.map((tramite) => tramite.colaboradorTecnico).filter(Boolean))
  ) as string[];
  const responsableActual =
    responsablesOrigen.length === 1 ? responsablesOrigen[0] : 'Multiples responsables';
  const responsableOrigenParaImpacto =
    responsablesOrigen.length === 1 ? responsablesOrigen[0] : '';
  const cargaActualOrigen = responsableOrigenParaImpacto
    ? cargaPorResponsable.get(responsableOrigenParaImpacto) ?? 0
    : undefined;
  const cargaActualDestino = nuevoResponsable
    ? cargaPorResponsable.get(nuevoResponsable) ?? 0
    : undefined;

  const confirmar = async () => {
    if (tramites.length === 0) {
      setMensaje('No hay tramites seleccionados.');
      return;
    }
    if (!nuevoResponsable) {
      setMensaje('Seleccione un nuevo responsable.');
      return;
    }
    if (responsablesOrigen.length === 1 && nuevoResponsable === responsablesOrigen[0]) {
      setMensaje('El nuevo responsable no puede ser igual al responsable actual.');
      return;
    }
    if (!motivo.trim()) {
      setMensaje('Ingrese el motivo de la redistribucion.');
      return;
    }
    const codigos = tramites
      .map(obtenerCodigoInternoTramite)
      .filter((codigo): codigo is number => codigo !== undefined);
    if (codigos.length !== tramites.length) {
      setMensaje('Uno o mas tramites seleccionados no tienen codigo interno numerico requerido por SOL.');
      return;
    }
    const codigoResponsable = obtenerCodigoResponsable(nuevoResponsable);
    if (codigoResponsable === undefined) {
      setMensaje('No se pudo resolver el codigo numerico del nuevo responsable.');
      return;
    }
    const resumen = `Vas a reasignar ${tramites.length} tramites hacia ${nuevoResponsable}.`;
    if (!window.confirm(resumen)) return;

    setProcesando(true);
    try {
      const resultado = await reasignarTramites({
        codigos,
        responsable: codigoResponsable,
        nota: comentario.trim() || motivo.trim(),
      });
      setMensaje(resultado.mensaje);
      if (resultado.ok) {
        setTimeout(onSuccess, 900);
      }
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? `No se pudo enviar la reasignacion al backend seguro. ${error.message}`
          : 'No se pudo enviar la reasignacion al backend seguro.'
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="redistribution-modal-backdrop" role="presentation">
      <div className="redistribution-modal redistribution-modal-wide" role="dialog" aria-modal="true">
        <div className="redistribution-modal-header">
          <div>
            <span className="redistribution-kicker">Redistribucion de carga</span>
            <h3>Reasignar seleccionados</h3>
          </div>
          <button className="modal-close-button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="redistribution-summary-card redistribution-summary-grid">
          <span>Seleccionados</span>
          <strong>{tramites.length}</strong>
          <span>Responsable actual</span>
          <strong>{responsableActual}</strong>
        </div>

        <div className="redistribution-form-grid">
          <label>
            Nuevo responsable
            <select
              value={nuevoResponsable}
              onChange={(event) => setNuevoResponsable(event.target.value)}
            >
              <option value="">Seleccione responsable</option>
              {responsables.map((responsable) => (
                <option key={responsable} value={responsable}>
                  {obtenerCodigoTecnico(responsable)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo obligatorio
            <input
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Redistribucion operativa de carga"
            />
          </label>
          <label className="redistribution-full-field">
            Comentario opcional
            <textarea
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
              rows={3}
              placeholder="Observaciones para bitacora futura"
            />
          </label>
        </div>

        <ImpactoRedistribucion
          responsableActual={responsableOrigenParaImpacto}
          nuevoResponsable={nuevoResponsable}
          cantidad={tramites.length}
          cargaActualOrigen={cargaActualOrigen}
          cargaActualDestino={cargaActualDestino}
        />

        <div className="redistribution-selected-list">
          <h4>Resumen de tramites seleccionados</h4>
          {tramites.slice(0, 8).map((tramite) => (
            <div key={tramite.id}>
              <span>{tramite.numeroTramite || tramite.id}</span>
              <small>{obtenerNomenclaturaTramite(tramite)}</small>
            </div>
          ))}
          {tramites.length > 8 && (
            <p>+ {tramites.length - 8} tramites adicionales</p>
          )}
        </div>

        {mensaje && <p className="redistribution-message">{mensaje}</p>}

        <div className="redistribution-modal-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={confirmar}
            disabled={procesando || tramites.length === 0}
          >
            {procesando ? 'Preparando...' : 'Confirmar redistribucion'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImpactoRedistribucion({
  responsableActual,
  nuevoResponsable,
  cantidad,
  cargaActualOrigen,
  cargaActualDestino,
}: {
  responsableActual?: string;
  nuevoResponsable?: string;
  cantidad: number;
  cargaActualOrigen?: number;
  cargaActualDestino?: number;
}) {
  if (!nuevoResponsable) {
    return null;
  }

  return (
    <div className="redistribution-impact">
      <h4>Impacto estimado en carga</h4>
      {responsableActual && cargaActualOrigen !== undefined && (
        <div>
          <span title={responsableActual}>{obtenerCodigoTecnico(responsableActual)}</span>
          <strong>
            {cargaActualOrigen} → {Math.max(0, cargaActualOrigen - cantidad)}
          </strong>
        </div>
      )}
      {cargaActualDestino !== undefined && (
        <div>
          <span title={nuevoResponsable}>{obtenerCodigoTecnico(nuevoResponsable)}</span>
          <strong>
            {cargaActualDestino} → {cargaActualDestino + cantidad}
          </strong>
        </div>
      )}
    </div>
  );
}

function TablaTramitesPasadosLegal({ tramites }: { tramites: TramiteNormalizado[] }) {
  if (tramites.length === 0) {
    return <p className="empty-state">No hay trámites pasados a legal para este técnico</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table compact-tramites-table">
        <thead>
          <tr>
            <th>Expediente</th>
            <th>Trámite</th>
            <th>Técnico</th>
            <th>Fecha inicio</th>
            <th>Fecha de pase a legal</th>
            <th>Días fase técnica</th>
            <th>Estado actual</th>
            <th>Fase actual</th>
          </tr>
        </thead>
        <tbody>
          {tramites.map((tramite) => (
            <tr key={`legal-${tramite.id}`}>
              <td className="cell-id">{tramite.numeroTramite || tramite.id}</td>
              <td
                className="cell-tramite-code"
                title={tramite.descripcion || tramite.tipo_tramite || 'Sin dato'}
              >
                {obtenerNomenclaturaTramite(tramite)}
              </td>
              <td
                className="cell-tecnico-code"
                title={tramite.colaboradorTecnico || 'Sin asignar'}
              >
                {obtenerCodigoTecnico(tramite.colaboradorTecnico)}
              </td>
              <td>{formatearFecha(tramite.fecha_inicio_gestion)}</td>
              <td>{formatearFecha(tramite.fecha_revision_tecnica)}</td>
              <td>{formatearTrazabilidad(tramite, tramite.diasEnFaseTecnica)}</td>
              <td>{tramite.estado_actual || tramite.estado}</td>
              <td>{tramite.faseActual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaRankingRetraso({ ranking }: { ranking: RetrasoPorFasePersona[] }) {
  if (ranking.length === 0) {
    return <p className="empty-state">Sin trazabilidad suficiente para ranking</p>;
  }

  return (
    <div className="tramites-table-wrapper">
      <table className="tramites-table">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Fase</th>
            <th>Trámites</th>
            <th>Promedio días</th>
            <th>Máximo días</th>
          </tr>
        </thead>
        <tbody>
          {ranking.slice(0, 20).map((item) => (
            <tr key={`${item.colaborador}-${item.fase}`}>
              <td className="cell-id">{item.colaborador}</td>
              <td>{item.fase}</td>
              <td>{item.cantidadTramites}</td>
              <td>{item.promedioDias}</td>
              <td>{item.maxDias}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosticoVista({ 
  diagnostico,
  totalFiltradosPorFecha,
}: {
  diagnostico: any;
  totalFiltradosPorFecha: number;
}) {
  const diagnosticoFechas = diagnostico.diagnosticoFechas;

  return (
    <div className="section diagnostico-section">
      <h2>Información de Diagnóstico (DEV)</h2>

      <div className="diagnostico-grid">
        <div className="diagnostico-card">
          <h3>Consulta JSON</h3>
          <pre>
            {JSON.stringify(
              {
                urlConsultada: diagnostico.urlConsultada,
                statusHttp: diagnostico.statusHttp,
                parametroEnviado: diagnostico.parametroEnviado,
                fuenteUsada: diagnostico.fuenteDatos,
                nombreArchivoCargado: diagnostico.nombreArchivo,
                totalRegistrosRecibidos:
                  diagnostico.totalRegistrosRecibidos,
                totalRegistrosNormalizados: diagnostico.cantidadRegistros,
                totalFiltradosPorFecha,
                totalEnSAC: diagnostico.totalEnSAC,
              },
              null,
              2
            )}
          </pre>
        </div>

        <div className="diagnostico-card">
          <h3>Indicadores calculados</h3>
          <pre>
            {JSON.stringify(
              {
                totalConFechaInicioValida:
                  diagnostico.totalFechaInicioValida,
                totalConFechaFinEsperadaValida:
                  diagnostico.totalFechaVencimientoValida,
                totalConFechaFinRealValida:
                  diagnostico.totalFechaFinalizacionValida,
                totalActivosCalculados:
                  diagnostico.totalActivosCalculados,
                totalFinalizadosCalculados:
                  diagnostico.totalFinalizadosCalculados,
                totalFueraDeTiempoCalculados:
                  diagnostico.totalFueraTiempoCalculados,
                totalProximosAVencerCalculados:
                  diagnostico.totalProximosVencerCalculados,
                totalEsperandoCiudadano:
                  diagnostico.totalEsperandoCiudadanoCalculados,
              },
              null,
              2
            )}
          </pre>
        </div>

        <div className="diagnostico-card">
          <h3>Fechas base</h3>
          <pre>
            {JSON.stringify(
              {
                campoFechaUtilizado: diagnosticoFechas?.camposFechaBase,
                tramitesConFechaValida:
                  diagnosticoFechas?.tramitesConFechaValida,
                tramitesSinFecha: diagnosticoFechas?.tramitesSinFecha,
                fechaMinima:
                  diagnosticoFechas?.fechaMinima?.toLocaleDateString('es-HN'),
                fechaMaxima:
                  diagnosticoFechas?.fechaMaxima?.toLocaleDateString('es-HN'),
              },
              null,
              2
            )}
          </pre>
        </div>

        <div className="diagnostico-card">
          <h3>Campos detectados</h3>
          <pre>
            {JSON.stringify(
              {
                camposDetectados: diagnostico.camposDetectados,
                camposNoMapeados: diagnostico.camposNoMapeados,
              },
              null,
              2
            )}
          </pre>
        </div>

        {diagnostico.primerRegistroCrudo && (
          <div className="diagnostico-card">
            <h3>Primer registro crudo recibido</h3>
            <pre className="json-preview">
              {JSON.stringify(diagnostico.primerRegistroCrudo, null, 2)}
            </pre>
          </div>
        )}

        {diagnostico.datosCrudos && (
          <div className="diagnostico-card">
            <h3>Respuesta cruda</h3>
            <pre className="json-preview">
              {JSON.stringify(diagnostico.datosCrudos, null, 2).substring(
                0,
                500
              )}
              {JSON.stringify(diagnostico.datosCrudos, null, 2).length > 500
                ? '...'
                : ''}
            </pre>
          </div>
        )}

        {diagnostico.datosNormalizados && (
          <div className="diagnostico-card">
            <h3>Datos Normalizados (Primer Trámite)</h3>
            <pre className="json-preview">
              {JSON.stringify(
                diagnostico.datosNormalizados.tramites[0],
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
