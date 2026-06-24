export type FuenteDatosLegal = 'API SOL' | 'JSON LOCAL' | 'MOCK';

export type CondicionLegal =
  | 'en_tiempo'
  | 'por_vencer'
  | 'vencido'
  | 'sin_fecha_probable';

export interface TramiteFaseLegalRaw {
  nombre_completo?: unknown;
  email?: unknown;
  dias_resolucion?: unknown;
  codigo_codificador?: unknown;
  fecha_inicio?: unknown;
  fecha_fin_esperada?: unknown;
  titulo_tramite?: unknown;
  nombre_fase?: unknown;
  estado?: unknown;
  [key: string]: unknown;
}

export interface TramiteFaseLegalDM {
  id: string;
  expediente: string;
  tramite: string;
  oficialLegal: string;
  emailOficial?: string;
  estado: string;
  fase: string;
  fechaIngresoLegal: Date | null;
  fuenteFechaIngresoLegal: string;
  fuenteFechaBase: string;
  fechaProbableSalida: Date | null;
  diasResolucion: number | null;
  diasLegal: number | null;
  diasEnLegal: number | null;
  diasRestantes: number | null;
  bucketDiasResolucion: string;
  condicion: CondicionLegal;
  margenCritico: boolean;
  margenCriticoDesdeTecnica: boolean;
  enPlazo: boolean;
  direccion: 'DM';
  codigoInterno?: string;
}

export interface CargaOficialLegalDM {
  oficialLegal: string;
  emailOficial?: string;
  total: number;
  vencidos: number;
  proximos: number;
  sinFechaProbable: number;
  margenCriticoDesdeTecnica: number;
  enPlazo: number;
  promedioDiasEnLegal: number | null;
  mayorAtraso: number | null;
  cargaPonderada: number;
}

export interface DistribucionLegalItem {
  key: string;
  label: string;
  value: number;
}

export interface AlertasFaseLegalDM {
  vencidos: TramiteFaseLegalDM[];
  proximos: TramiteFaseLegalDM[];
  sinFechaProbable: TramiteFaseLegalDM[];
  margenCritico: TramiteFaseLegalDM[];
  mayorDiasLegal: TramiteFaseLegalDM[];
}

export interface PrioridadOperativaLegalDM {
  vencidos: number;
  proximos: number;
  margenCritico: number;
  sinFechaProbable: number;
  mayorCargaOficial: string | null;
  mayorCargaTotal: number;
  mayorDiasEnLegal: number | null;
}

export interface MetricasFaseLegalDM {
  totalEnLegal: number;
  oficialesConCarga: number;
  vencidos: number;
  proximosAVencer: number;
  sinFechaProbable: number;
  margenCriticoDesdeTecnica: number;
  promedioDiasEnLegal: number | null;
  mayorCargaLegal: number;
  tramitesDentroPlazo: number;
  cargaPonderadaLegal: number;
  mayorDiasEnLegal: number | null;
}

export interface RespuestaFaseLegalDM {
  tramites: TramiteFaseLegalDM[];
  cargaPorOficial: CargaOficialLegalDM[];
  matrizOficialLegal: CargaOficialLegalDM[];
  distribucionPorCondicion: DistribucionLegalItem[];
  distribucionPorDiasLegal: DistribucionLegalItem[];
  distribucionPorDiasRestantes: DistribucionLegalItem[];
  alertasLegal: AlertasFaseLegalDM;
  prioridadOperativaLegal: PrioridadOperativaLegalDM;
  metricas: MetricasFaseLegalDM;
  fechaActualizacion: Date;
  fuenteDatos: FuenteDatosLegal;
  datosCrudos?: TramiteFaseLegalRaw[];
  totalRegistrosRecibidos: number;
  urlConsultada?: string;
  statusHttp?: number;
  mensajeError?: string;
}
