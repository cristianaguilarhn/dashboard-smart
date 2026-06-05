import {
  CampoFechaBase,
  CumplimientoTramite,
  EstadoTramite,
  FaseTramite,
  RespuestaSolCruda,
  RespuestaTramitesNormalizada,
  RiesgoTramite,
  TramiteNormalizado,
} from '../types/sol';

const MS_DIA = 1000 * 60 * 60 * 24;

const CAMPOS_REALES_NORMALIZADOS = [
  'EXPEDIENTE',
  'TRAMITE',
  'ESTADO FINAL',
  'FECHA INICIO',
  'FECHA PROBABLE DE SALIDA',
  'DIAS RESOLUCION',
  'PRESENTACION FECHA',
  'PRESENTACION CIUDADANO',
  'ADMISION SAC FECHA',
  'ADMISION SAC USUARIO',
  'FECHA REV TECNICA',
  'REV TECNICA USUARIO',
  'FECHA REV LEGAL',
  'REV LEGAL USUARIO',
  'FECHA SUBSANACION',
  'SUBSANACION USUARIO',
  'FECHA EMISION',
  'EMISION USUARIO',
  'FECHA INSPECCION',
  'INSPECCION USUARIO',
  'FECHA RECURSO',
  'RECURSO USUARIO',
  'FINALIZACION',
  'ESTADO',
  'F_P_ DE SALIDA',
  'F_SUBSANACION',
  'F_FINALIZACION',
  'F_REV_TEC',
  'REV_LEGAL',
  'INSP',
  'FECHA HOY',
  'MES_PROBAB',
  'MES_ADM',
  'MES_FINALIZACION',
  'SAC',
  'REV_TEC',
  'R_LEGAL',
  'Numero de tramite',
  'Fecha de inicio',
  'Fecha fin esperada',
  'Fecha fin Real',
  'Nombre del servicio',
  'Nombre de la fase',
  'responsable',
  'estado solicitud tecnico',
  'estado solicitud legal',
  'Fecha de Requerido',
  'nombre_completo',
  'email',
  'dias_resolucion',
  'codigo_codificador',
  'fecha_inicio',
  'fecha_fin_esperada',
  'titulo_tramite',
  'nombre_fase',
].map((campo) => normalizarNombreCampo(campo));

function corregirMojibake(texto: string): string {
  return texto
    .replace(/Ã¡/g, 'a')
    .replace(/Ã©/g, 'e')
    .replace(/Ã­/g, 'i')
    .replace(/Ã³/g, 'o')
    .replace(/Ãº/g, 'u')
    .replace(/Ã±/g, 'n')
    .replace(/Ã/g, 'A')
    .replace(/Ã‰/g, 'E')
    .replace(/Ã/g, 'I')
    .replace(/Ã“/g, 'O')
    .replace(/Ãš/g, 'U')
    .replace(/Ã‘/g, 'N')
    .replace(/Â/g, '');
}

function normalizarNombreCampo(nombre: string): string {
  return corregirMojibake(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function valorCampo<T = unknown>(
  raw: Record<string, unknown>,
  variantes: string[]
): T | undefined {
  for (const campo of variantes) {
    if (Object.prototype.hasOwnProperty.call(raw, campo)) {
      return raw[campo] as T;
    }
  }

  const variantesNormalizadas = variantes.map(normalizarNombreCampo);
  for (const [campo, valor] of Object.entries(raw)) {
    if (variantesNormalizadas.includes(normalizarNombreCampo(campo))) {
      return valor as T;
    }
  }

  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  const texto = String(value).trim();
  if (!texto) return undefined;

  const ddMmYyyy = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddMmYyyy) {
    const [, dia, mes, anio] = ddMmYyyy;
    const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
    return isNaN(fecha.getTime()) ? undefined : fecha;
  }

  const fecha = new Date(texto);
  return isNaN(fecha.getTime()) ? undefined : fecha;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inicioDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function calcularDias(from: Date | undefined, to: Date | undefined): number {
  if (!from || !to) return 0;
  return Math.floor((inicioDia(to).getTime() - inicioDia(from).getTime()) / MS_DIA);
}

function calcularDiasOpcional(from: Date | undefined, to: Date | undefined): number | undefined {
  if (!from || !to) return undefined;
  return calcularDias(from, to);
}

function extraerRegistros(respuestaCruda: RespuestaSolCruda): Record<string, unknown>[] {
  const data = respuestaCruda.data;
  if (Array.isArray(respuestaCruda)) return respuestaCruda;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const nested = data as RespuestaSolCruda;
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.registros)) return nested.registros;
    if (Array.isArray(nested.items)) return nested.items;
  }
  if (Array.isArray(respuestaCruda.registros)) return respuestaCruda.registros;
  if (Array.isArray(respuestaCruda.items)) return respuestaCruda.items;
  return [];
}

function extraerRegistrosDesde(valor: unknown): Record<string, unknown>[] {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor === 'object') {
    const objeto = valor as RespuestaSolCruda;
    if (Array.isArray(objeto.data)) return objeto.data;
    if (Array.isArray(objeto.registros)) return objeto.registros;
    if (Array.isArray(objeto.items)) return objeto.items;
  }
  return [];
}

function detectarFaseTrazabilidad(fase?: string): FaseTramite | undefined {
  const normalizada = normalizarNombreCampo(fase || '');
  if (!normalizada) return undefined;
  if (normalizada.includes('legal') || normalizada.includes('emision')) return 'legal';
  if (normalizada.includes('tecnica') || normalizada.includes('tecnico')) return 'tecnica';
  if (normalizada.includes('sac') || normalizada.includes('admision')) return 'sac';
  return undefined;
}

export function obtenerFechaBaseTramite(
  raw: Record<string, unknown>
): { fecha?: Date; campo?: CampoFechaBase } {
  const candidatos: Array<[CampoFechaBase, unknown]> = [
    ['fecha_inicio_gestion', valorCampo(raw, ['FECHA INICIO', 'Fecha de inicio', 'fecha_inicio'])],
    ['fecha_presentacion', valorCampo(raw, ['PRESENTACION FECHA'])],
    ['fecha_asignacion', valorCampo(raw, ['ADMISION SAC FECHA'])],
    ['fecha_actualizacion', valorCampo(raw, ['FECHA REV TECNICA'])],
    ['fecha_actualizacion', valorCampo(raw, ['FECHA REV LEGAL'])],
    ['fecha_actualizacion', valorCampo(raw, ['FINALIZACION', 'Fecha fin Real'])],
  ];

  for (const [campo, valor] of candidatos) {
    const fecha = parseDate(valor);
    if (fecha) return { fecha, campo };
  }

  return {};
}

function calcularEstado(
  enSAC: boolean,
  fechaFinalizacion?: Date,
  fechaProbableSalida?: Date
): EstadoTramite {
  if (enSAC) return 'sac';
  if (fechaFinalizacion) return 'finalizado';
  if (!fechaProbableSalida) return 'activo';

  const hoy = inicioDia(new Date());
  const vencimiento = inicioDia(fechaProbableSalida);
  const diasRestantes = calcularDias(hoy, vencimiento);

  if (vencimiento < hoy) return 'vencido';
  if (diasRestantes <= 3) return 'por_vencer';
  return 'activo';
}

function calcularRiesgo(
  estado: EstadoTramite,
  porcentajeTiempoConsumido?: number
): RiesgoTramite {
  if (estado === 'finalizado') return 'finalizado';
  if (estado === 'vencido') return 'alto';
  if (porcentajeTiempoConsumido !== undefined && porcentajeTiempoConsumido >= 90) {
    return 'alto';
  }
  if (estado === 'por_vencer') return 'medio';
  return 'normal';
}

function calcularCumplimiento(
  fechaFinalizacion?: Date,
  fechaProbableSalida?: Date
): CumplimientoTramite {
  if (!fechaFinalizacion) return 'pendiente';
  if (!fechaProbableSalida) return 'cumplio';
  return inicioDia(fechaFinalizacion) <= inicioDia(fechaProbableSalida)
    ? 'cumplio'
    : 'fuera_de_tiempo';
}

function detectarFase(
  enSAC: boolean,
  fechaFinalizacion?: Date,
  fechaRevisionTecnica?: Date,
  fechaRevisionLegal?: Date,
  usuarioRevisionLegal?: string
): FaseTramite {
  if (enSAC) return 'sac';
  if (fechaFinalizacion) return 'finalizado';
  if (fechaRevisionTecnica || fechaRevisionLegal || usuarioRevisionLegal) return 'legal';
  return 'tecnica';
}

export function normalizarTramite(
  raw: Record<string, unknown>,
  indice: number
): { tramite: TramiteNormalizado; camposNoMapeados: string[] } {
  const expediente = valorCampo(raw, ['EXPEDIENTE', 'codigo_codificador']);
  const numeroTramite = valorCampo(raw, [
    'Numero de tramite',
    'numero_tramite',
    'numeroTramite',
    'NumeroTramite',
    'codigo_codificador',
  ]);
  const tipoTramite = valorCampo<string>(raw, [
    'TRAMITE',
    'Nombre del servicio',
    'titulo_tramite',
  ]);
  const estadoFinal = valorCampo<string>(raw, ['ESTADO FINAL']);
  const estadoActual = valorCampo<string>(raw, ['ESTADO', 'estado']);
  const faseTrazabilidad = valorCampo<string>(raw, [
    'Nombre de fase',
    'nombre_fase',
  ]);
  const responsableTrazabilidad = valorCampo<string>(raw, [
    'responsable',
    'nombre_completo',
  ]);
  const fechaInicio = parseDate(
    valorCampo(raw, ['FECHA INICIO', 'Fecha de inicio', 'fecha_inicio'])
  );
  const fechaPresentacion = parseDate(valorCampo(raw, ['PRESENTACION FECHA']));
  const fechaProbableSalida = parseDate(
    valorCampo(raw, [
      'FECHA PROBABLE DE SALIDA',
      'Fecha fin esperada',
      'fecha_fin_esperada',
    ])
  );
  const diasResolucionDirecto = parseNumber(valorCampo(raw, ['DIAS RESOLUCION', 'dias_resolucion']));
  const fechaFinalizacion = parseDate(valorCampo(raw, ['FINALIZACION', 'Fecha fin Real']));
  const fechaRevisionTecnica = parseDate(valorCampo(raw, ['FECHA REV TECNICA']));
  const usuarioRevisionTecnica = valorCampo<string>(raw, ['REV TECNICA USUARIO']);
  const fechaRevisionLegal = parseDate(valorCampo(raw, ['FECHA REV LEGAL']));
  const usuarioRevisionLegal = valorCampo<string>(raw, ['REV LEGAL USUARIO']);
  const fechaSubsanacion = parseDate(valorCampo(raw, ['FECHA SUBSANACION', 'Fecha de Requerido']));
  const usuarioSubsanacion = valorCampo<string>(raw, ['SUBSANACION USUARIO']);
  const fechaEmision = parseDate(valorCampo(raw, ['FECHA EMISION']));
  const usuarioEmision = valorCampo<string>(raw, ['EMISION USUARIO']);
  const fechaHoy = parseDate(valorCampo(raw, ['FECHA HOY'])) || new Date();
  const diasSac = parseNumber(valorCampo(raw, ['SAC']));
  const diasRevisionTecnica = parseNumber(valorCampo(raw, ['REV_TEC']));
  const diasRevisionLegal = parseNumber(valorCampo(raw, ['R_LEGAL']));
  const diasInspeccion = parseNumber(valorCampo(raw, ['INSP']));
  const fSubsanacion = String(valorCampo(raw, ['F_SUBSANACION']) || '').toUpperCase();
  const tieneExpediente = Boolean(String(expediente || '').trim());
  const enGestion = tieneExpediente && Boolean(fechaInicio);
  const enSAC = !enGestion;
  const idTramite = String(expediente || numeroTramite || `SAC_${indice}`);
  const { fecha: fechaBase, campo: campoFechaBase } = obtenerFechaBaseTramite(raw);
  const fechaInicioFinal = fechaInicio || fechaBase || new Date();
  const diasResolucionCalculados = calcularDiasOpcional(fechaInicio, fechaProbableSalida);
  const diasResolucion = diasResolucionDirecto ?? diasResolucionCalculados;
  const plazoDefinido = diasResolucion !== undefined;
  const diaActual = calcularDias(fechaInicio || fechaBase, fechaHoy);
  const porcentajeTiempoConsumido =
    diasResolucion && diasResolucion > 0 ? (diaActual / diasResolucion) * 100 : undefined;
  const estado =
    enSAC
      ? 'sac'
      : fechaSubsanacion || fSubsanacion === 'SI'
      ? 'requerido'
      : calcularEstado(enSAC, fechaFinalizacion, fechaProbableSalida);
  const riesgo = calcularRiesgo(estado, porcentajeTiempoConsumido);
  const cumplimiento = calcularCumplimiento(fechaFinalizacion, fechaProbableSalida);
  const diasRestantes = fechaProbableSalida
    ? calcularDias(fechaHoy, fechaProbableSalida)
    : undefined;
  const fasePorTrazabilidad = detectarFaseTrazabilidad(faseTrazabilidad);
  const faseActual = fasePorTrazabilidad || detectarFase(
    enSAC,
    fechaFinalizacion,
    fechaRevisionTecnica,
    fechaRevisionLegal,
    usuarioRevisionLegal
  );
  const colaboradorTecnicoFinal =
    faseActual === 'tecnica'
      ? responsableTrazabilidad || usuarioRevisionTecnica
      : usuarioRevisionTecnica;
  const colaboradorLegalFinal =
    faseActual === 'legal'
      ? responsableTrazabilidad || usuarioRevisionLegal
      : usuarioRevisionLegal;
  const personaAsignada =
    faseActual === 'legal'
      ? colaboradorLegalFinal || colaboradorTecnicoFinal
      : colaboradorTecnicoFinal || colaboradorLegalFinal;
  const diasTecnicaEstimados =
    diasRevisionTecnica ??
    (fechaRevisionTecnica
      ? calcularDias(fechaInicio, fechaRevisionTecnica)
      : undefined);
  const diasLegalEstimados =
    diasRevisionLegal ??
    (fechaRevisionLegal
      ? calcularDias(fechaRevisionLegal, fechaFinalizacion || fechaEmision || fechaHoy)
      : undefined);
  const trazabilidadFasesSuficiente =
    Boolean(diasTecnicaEstimados !== undefined || diasLegalEstimados !== undefined);

  const tramite: TramiteNormalizado = {
    id: idTramite,
    id_tramite: idTramite,
    tipo: 'DM',
    tipo_tramite: tipoTramite,
    numeroTramite: idTramite,
    estado,
    enSAC,
    enGestion,
    personaAsignada,
    estado_final: estadoFinal,
    estado_actual: estadoActual,
    faseActual,
    descripcion: tipoTramite,
    fechaInicio: fechaInicioFinal,
    fecha_inicio_gestion: fechaInicio,
    fecha_presentacion: fechaPresentacion,
    fecha_probable_salida: fechaProbableSalida,
    fecha_revision_tecnica: fechaRevisionTecnica,
    usuario_revision_tecnica: usuarioRevisionTecnica,
    fecha_revision_legal: fechaRevisionLegal,
    usuario_revision_legal: usuarioRevisionLegal,
    fecha_subsanacion: fechaSubsanacion,
    usuario_subsanacion: usuarioSubsanacion,
    fecha_emision: fechaEmision,
    usuario_emision: usuarioEmision,
    fecha_hoy: fechaHoy,
    fechaBase,
    campoFechaBase,
    sinFechaIdentificada: !fechaBase,
    fechaFinalizacion,
    fecha_finalizacion: fechaFinalizacion,
    fechaVencimiento: fechaProbableSalida,
    fecha_vencimiento: fechaProbableSalida,
    diasTranscurridos: diaActual,
    plazoDias: diasResolucion,
    plazo_dias: diasResolucion,
    dias_resolucion: diasResolucion,
    diasResolucionCalculados,
    plazoDefinido,
    diaActual,
    porcentajeTiempoConsumido,
    diasRestantes,
    plazoTotal: diasResolucion,
    dias_sac: diasSac,
    dias_revision_tecnica: diasRevisionTecnica,
    dias_revision_legal: diasRevisionLegal,
    dias_inspeccion: diasInspeccion,
    riesgo,
    cumplimiento,
    colaboradorTecnico: colaboradorTecnicoFinal,
    colaboradorLegal: colaboradorLegalFinal,
    diasEnFaseTecnica: diasTecnicaEstimados,
    diasEnFaseLegal: diasLegalEstimados,
    trazabilidadFasesSuficiente,
    diagnosticoTrazabilidad: trazabilidadFasesSuficiente
      ? undefined
      : 'Sin trazabilidad suficiente',
    direccion: 'DM',
  };

  const camposNoMapeados = Object.keys(raw).filter(
    (campo) => !CAMPOS_REALES_NORMALIZADOS.includes(normalizarNombreCampo(campo))
  );

  return { tramite, camposNoMapeados };
}

export function normalizarRespuestaSol(
  respuestaCruda: RespuestaSolCruda,
  direccion: string = 'DM'
): {
  respuestaNormalizada: RespuestaTramitesNormalizada;
  camposNoMapeados: string[];
  camposDetectados: string[];
  totalRegistrosRecibidos: number;
  primerRegistroCrudo?: RespuestaSolCruda;
} {
  const registrosBase = extraerRegistros(respuestaCruda);
  const trazabilidad = extraerRegistrosDesde(respuestaCruda.trazabilidadData);
  const trazabilidadPorTramite = new Map<string, Record<string, unknown>>();

  trazabilidad.forEach((registro) => {
    const id = valorCampo(registro, [
      'Numero de tramite',
      'Número de tramite',
      'numero_tramite',
      'numeroTramite',
      'NumeroTramite',
    ]);
    if (id) trazabilidadPorTramite.set(String(id), registro);
  });

  const registros = registrosBase.map((registro) => {
    const id = valorCampo(registro, [
      'EXPEDIENTE',
      'Numero de tramite',
      'Número de tramite',
      'numero_tramite',
      'numeroTramite',
      'NumeroTramite',
    ]);
    const registroTrazabilidad = id
      ? trazabilidadPorTramite.get(String(id))
      : undefined;
    return registroTrazabilidad
      ? { ...registroTrazabilidad, ...registro }
      : registro;
  });
  const resultados = registros.map((registro, indice) =>
    normalizarTramite(registro, indice)
  );

  const camposNoMapeados = Array.from(
    resultados.reduce((set, resultado) => {
      resultado.camposNoMapeados.forEach((campo) => set.add(campo));
      return set;
    }, new Set<string>())
  );

  const camposDetectados = Array.from(
    registros.reduce((set, registro) => {
      Object.keys(registro).forEach((campo) => set.add(campo));
      return set;
    }, new Set<string>())
  );

  return {
    respuestaNormalizada: {
      tramites: resultados.map((resultado) => resultado.tramite),
      fecha_actualizacion: new Date(),
      total_registros: resultados.length,
      direccion: (direccion as any) || 'DM',
    },
    camposNoMapeados,
    camposDetectados,
    totalRegistrosRecibidos: registros.length,
    primerRegistroCrudo: registros[0],
  };
}

export function normalizarMetricasUgcDM(respuestaCruda: RespuestaSolCruda) {
  return normalizarRespuestaSol(respuestaCruda, 'DM');
}
