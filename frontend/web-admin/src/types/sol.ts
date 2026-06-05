/**
 * Tipos para la integración con API SOL
 * Estos tipos representan el modelo normalizado interno del dashboard
 */

/**
 * Estado de un trámite
 */
export type EstadoTramite =
  | 'sac'
  | 'activo'
  | 'finalizado'
  | 'vencido'
  | 'por_vencer'
  | 'requerido';
export type RiesgoTramite = 'alto' | 'medio' | 'normal' | 'finalizado';
export type CumplimientoTramite = 'cumplio' | 'fuera_de_tiempo' | 'pendiente';

/**
 * Fase del trámite
 */
export type FaseTramite =
  | 'sac'
  | 'tecnica'
  | 'legal'
  | 'requerido_ciudadano'
  | 'finalizado';

/**
 * Tipo de trámite
 */
export type TipoTramite = 'DM' | 'AB' | 'PF' | 'VF';

export type CampoFechaBase =
  | 'fecha_inicio_gestion'
  | 'fecha_presentacion'
  | 'fecha_solicitud'
  | 'fecha_creacion'
  | 'fecha_asignacion'
  | 'fecha_actualizacion';

export type PeriodoFiltro =
  | 'hoy'
  | 'semana'
  | 'mes'
  | 'mes_anterior'
  | 'personalizado'
  | 'historico';

/**
 * Interfaz normalizada de un trámite
 */
export interface TramiteNormalizado {
  id: string; // ID único del trámite
  id_tramite: string;
  tipo: TipoTramite;
  tipo_tramite?: string;
  estado_final?: string;
  estado_actual?: string;
  numeroTramite?: string; // Número de referencia
  estado: EstadoTramite;
  faseActual: FaseTramite;
  enSAC: boolean;
  enGestion: boolean;
  personaAsignada?: string;
  descripcion?: string;

  // Fechas
  fechaInicio: Date;
  fecha_inicio_gestion?: Date;
  fecha_presentacion?: Date;
  fecha_probable_salida?: Date;
  fecha_revision_tecnica?: Date;
  usuario_revision_tecnica?: string;
  fecha_revision_legal?: Date;
  usuario_revision_legal?: string;
  fecha_subsanacion?: Date;
  usuario_subsanacion?: string;
  fecha_emision?: Date;
  usuario_emision?: string;
  fecha_hoy?: Date;
  fechaBase?: Date;
  campoFechaBase?: CampoFechaBase;
  sinFechaIdentificada: boolean;
  fechaPaseALegal?: Date;
  fechaRequerimiento?: Date;
  fechaRespuestaCiudadano?: Date;
  fechaFinalizacion?: Date;
  fecha_finalizacion?: Date;
  fechaVencimiento?: Date;
  fecha_vencimiento?: Date;

  // Plazos
  diasTranscurridos: number;
  plazoDias?: number;
  plazo_dias?: number;
  dias_resolucion?: number;
  diasResolucionCalculados?: number;
  plazoDefinido: boolean;
  dias_sac?: number;
  dias_revision_tecnica?: number;
  dias_revision_legal?: number;
  dias_inspeccion?: number;
  diaActual: number;
  porcentajeTiempoConsumido?: number;
  diasRestantes?: number;
  plazoTotal?: number;
  riesgo: RiesgoTramite;
  cumplimiento: CumplimientoTramite;

  // Colaboradores
  colaboradorTecnico?: string;
  colaboradorLegal?: string;

  // Duración en fases
  diasEnFaseTecnica?: number;
  diasEnFaseLegal?: number;
  trazabilidadFasesSuficiente: boolean;
  diagnosticoTrazabilidad?: string;

  // Dirección
  direccion: string;
}

/**
 * Respuesta normalizada del endpoint /api/Reportes/trasabilidad-tramites
 */
export interface RespuestaTramitesNormalizada {
  tramites: TramiteNormalizado[];
  fecha_actualizacion: Date;
  total_registros: number;
  direccion: TipoTramite;
}

/**
 * Tipo de respuesta cruda de la API (desconocida inicialmente)
 */
export interface RespuestaSolCruda {
  [key: string]: any;
}

/**
 * Resultado del fetch con metadatos de diagnóstico
 */
export interface ResultadoFetchTramites {
  datos: RespuestaTramitesNormalizada;
  esSimulado: boolean;
  mensajeError?: string;
  datosCrudos?: RespuestaSolCruda;
  datosNormalizados?: RespuestaTramitesNormalizada;
  camposNoMapeados?: string[];
  camposDetectados?: string[];
  cantidadRegistros: number;
  totalRegistrosRecibidos?: number;
  primerRegistroCrudo?: RespuestaSolCruda;
  nombreArchivo?: string;
  urlConsultada?: string;
  parametroEnviado?: string;
  statusHttp?: number;
  fuenteDatos?: 'API REAL' | 'JSON LOCAL' | 'MOCK';
}

export interface CargaColaborador {
  colaborador: string;
  rol: 'tecnica' | 'legal' | 'mixto';
  cantidadTramites: number;
  totalDiasResolucion: number;
  promedioDiasResolucion?: number;
  tramitesPlazo5: number;
  tramitesPlazo10: number;
  tramitesPlazo15: number;
  tramitesPlazoMayor: number;
  tramitesPlazoNoDefinido: number;
  cambiosHoy: number;
  tramitesVencidos: number;
  tramitesProximosAVencer: number;
  tramitesEnTecnica: number;
  tramitesEnLegal: number;
  promedioDiasFaseTecnica?: number;
  promedioDiasFaseLegal?: number;
}

export interface RetrasoPorFasePersona {
  colaborador: string;
  fase: FaseTramite;
  cantidadTramites: number;
  promedioDias: number;
  maxDias: number;
}

/**
 * Métricas del dashboard
 */
export interface MetricasDashboard {
  tramitesActivosDM: number;
  tramitesFinalizados: number;
  finalizadosHoy: number;
  finalizadosEstaSemana: number;
  finalizadosEsteMes: number;
  vencidos: number;
  porVencer: number;
  requeridosAlCiudadano: number;
  sinAsignar: number;
  tiempoPromedioFaseTecnica: number;
  tiempoPromedioFaseLegal: number;
  tramitesEnFaseTecnica: number;
  tramitesEnFaseLegal: number;
  tramiteCriticos: TramiteNormalizado[];
  cargaPorColaborador: Record<string, number>;
  cargaDetalladaPorColaborador: CargaColaborador[];
  cargaTecnica: CargaColaborador[];
  cargaLegal: CargaColaborador[];
  rankingCargaPorPersona: CargaColaborador[];
  rankingRetrasoPorFasePersona: RetrasoPorFasePersona[];
  tramitesEnLegal: TramiteNormalizado[];
  tramitesEnSAC: number;
}

export interface FiltroFechaDashboard {
  periodo: PeriodoFiltro;
  fechaInicio?: Date;
  fechaFin?: Date;
  incluirSinFecha: boolean;
}

export interface DiagnosticoFechas {
  camposFechaBase: Record<string, number>;
  tramitesConFechaValida: number;
  tramitesSinFecha: number;
  fechaMinima?: Date;
  fechaMaxima?: Date;
}
