import {
  CargaOficialLegalDM,
  CondicionLegal,
  DistribucionLegalItem,
  FuenteDatosLegal,
  MetricasFaseLegalDM,
  RespuestaFaseLegalDM,
  TramiteFaseLegalDM,
  TramiteFaseLegalRaw,
} from '../types/solLegal';

const MS_DIA = 1000 * 60 * 60 * 24;

function normalizarNombreCampo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function valorCampo(
  raw: TramiteFaseLegalRaw,
  variantes: string[]
): unknown {
  for (const variante of variantes) {
    if (Object.prototype.hasOwnProperty.call(raw, variante)) {
      return raw[variante];
    }
  }

  const normalizadas = variantes.map(normalizarNombreCampo);
  for (const [campo, valor] of Object.entries(raw)) {
    if (normalizadas.includes(normalizarNombreCampo(campo))) {
      return valor;
    }
  }

  return undefined;
}

function valorTexto(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  const texto = String(valor).trim();
  return texto || undefined;
}

function valorNumero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor !== 'string') return null;
  const numero = Number(valor.replace(',', '.').trim());
  return Number.isFinite(numero) ? numero : null;
}

function parseFecha(valor: unknown): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const texto = String(valor).trim();
  if (!texto) return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function inicioDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function calcularDias(inicio: Date | null, fin: Date | null): number | null {
  if (!inicio || !fin) return null;
  return Math.floor(
    (inicioDia(fin).getTime() - inicioDia(inicio).getTime()) / MS_DIA
  );
}

function clasificarCondicion(fechaProbableSalida: Date | null, hoy: Date): CondicionLegal {
  if (!fechaProbableSalida) return 'sin_fecha_probable';
  const diasRestantes = calcularDias(hoy, fechaProbableSalida);
  if (diasRestantes === null) return 'sin_fecha_probable';
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 3) return 'por_vencer';
  return 'en_tiempo';
}

function obtenerBucketDiasResolucion(diasResolucion: number | null): string {
  if (diasResolucion === 3) return 'p3';
  if (diasResolucion === 5) return 'p5';
  if (diasResolucion === 8) return 'p8';
  if (diasResolucion === 10) return 'p10';
  if (diasResolucion === 15) return 'p15';
  if (diasResolucion === 20) return 'p20';
  if (diasResolucion === 30) return 'p30';
  if (diasResolucion === 40) return 'p40';
  if (diasResolucion === 45) return 'p45';
  if (diasResolucion === 60) return 'p60';
  if (diasResolucion === 90) return 'p90';
  return 'noDefinido';
}

function promedio(valores: Array<number | null>): number | null {
  const validos = valores.filter(
    (valor): valor is number => valor !== null && Number.isFinite(valor)
  );
  if (validos.length === 0) return null;
  return Math.round(
    (validos.reduce((sum, valor) => sum + valor, 0) / validos.length) * 10
  ) / 10;
}

function calcularPesoCarga(tramite: TramiteFaseLegalDM): number {
  if (tramite.condicion === 'vencido') return 4;
  if (tramite.condicion === 'por_vencer') return 3;
  if (tramite.condicion === 'sin_fecha_probable') return 2;
  return 1;
}

function construirCargaPorOficial(tramites: TramiteFaseLegalDM[]): CargaOficialLegalDM[] {
  const grupos = new Map<string, CargaOficialLegalDM>();

  tramites.forEach((tramite) => {
    const oficial = tramite.oficialLegal || 'No disponible';
    if (!grupos.has(oficial)) {
      grupos.set(oficial, {
        oficialLegal: oficial,
        emailOficial: tramite.emailOficial,
        total: 0,
        vencidos: 0,
        proximos: 0,
        sinFechaProbable: 0,
        margenCriticoDesdeTecnica: 0,
        enPlazo: 0,
        promedioDiasEnLegal: null,
        mayorAtraso: null,
        cargaPonderada: 0,
      });
    }

    const row = grupos.get(oficial)!;
    row.total += 1;
    if (tramite.condicion === 'vencido') row.vencidos += 1;
    if (tramite.condicion === 'por_vencer') row.proximos += 1;
    if (tramite.condicion === 'sin_fecha_probable') row.sinFechaProbable += 1;
    if (tramite.margenCriticoDesdeTecnica) row.margenCriticoDesdeTecnica += 1;
    if (tramite.enPlazo) row.enPlazo += 1;
    if (tramite.diasRestantes !== null && tramite.diasRestantes < 0) {
      row.mayorAtraso = Math.max(row.mayorAtraso ?? 0, Math.abs(tramite.diasRestantes));
    }
    row.cargaPonderada += calcularPesoCarga(tramite);
  });

  return Array.from(grupos.values()).map((row) => ({
    ...row,
    promedioDiasEnLegal: promedio(
      tramites
        .filter((tramite) => tramite.oficialLegal === row.oficialLegal)
        .map((tramite) => tramite.diasEnLegal)
    ),
  })).sort((a, b) => {
    if (b.vencidos !== a.vencidos) return b.vencidos - a.vencidos;
    if (b.proximos !== a.proximos) return b.proximos - a.proximos;
    if (b.cargaPonderada !== a.cargaPonderada) return b.cargaPonderada - a.cargaPonderada;
    if (b.total !== a.total) return b.total - a.total;
    return a.oficialLegal.localeCompare(b.oficialLegal);
  });
}

function calcularMetricas(
  tramites: TramiteFaseLegalDM[],
  cargaPorOficial: CargaOficialLegalDM[]
): MetricasFaseLegalDM {
  return {
    totalEnLegal: tramites.length,
    oficialesConCarga: cargaPorOficial.length,
    vencidos: tramites.filter((tramite) => tramite.condicion === 'vencido').length,
    proximosAVencer: tramites.filter((tramite) => tramite.condicion === 'por_vencer').length,
    sinFechaProbable: tramites.filter((tramite) => tramite.condicion === 'sin_fecha_probable').length,
    margenCriticoDesdeTecnica: tramites.filter((tramite) => tramite.margenCriticoDesdeTecnica).length,
    promedioDiasEnLegal: promedio(tramites.map((tramite) => tramite.diasEnLegal)),
    mayorCargaLegal: cargaPorOficial.reduce((max, row) => Math.max(max, row.total), 0),
    tramitesDentroPlazo: tramites.filter((tramite) => tramite.enPlazo).length,
    cargaPonderadaLegal: cargaPorOficial.reduce((sum, row) => sum + row.cargaPonderada, 0),
    mayorDiasEnLegal: tramites.reduce(
      (max: number | null, tramite) =>
        tramite.diasEnLegal === null ? max : Math.max(max ?? 0, tramite.diasEnLegal),
      null
    ),
  };
}

function contarPorRango(
  tramites: TramiteFaseLegalDM[],
  obtenerValor: (tramite: TramiteFaseLegalDM) => number | null,
  rangos: Array<{ key: string; label: string; match: (valor: number | null) => boolean }>
): DistribucionLegalItem[] {
  return rangos.map((rango) => ({
    key: rango.key,
    label: rango.label,
    value: tramites.filter((tramite) => rango.match(obtenerValor(tramite))).length,
  }));
}

function construirDistribucionPorCondicion(tramites: TramiteFaseLegalDM[]): DistribucionLegalItem[] {
  return [
    { key: 'vencido', label: 'Vencidos', value: tramites.filter((t) => t.condicion === 'vencido').length },
    { key: 'por_vencer', label: 'Próximos', value: tramites.filter((t) => t.condicion === 'por_vencer').length },
    { key: 'en_tiempo', label: 'En plazo', value: tramites.filter((t) => t.condicion === 'en_tiempo').length },
    { key: 'sin_fecha_probable', label: 'Sin fecha', value: tramites.filter((t) => t.condicion === 'sin_fecha_probable').length },
  ];
}

function construirDistribucionPorDiasLegal(tramites: TramiteFaseLegalDM[]): DistribucionLegalItem[] {
  return contarPorRango(tramites, (tramite) => tramite.diasEnLegal, [
    { key: '0-3', label: '0-3 días', match: (valor) => valor !== null && valor <= 3 },
    { key: '4-7', label: '4-7 días', match: (valor) => valor !== null && valor >= 4 && valor <= 7 },
    { key: '8-15', label: '8-15 días', match: (valor) => valor !== null && valor >= 8 && valor <= 15 },
    { key: '16-30', label: '16-30 días', match: (valor) => valor !== null && valor >= 16 && valor <= 30 },
    { key: '30+', label: 'Más de 30', match: (valor) => valor !== null && valor > 30 },
    { key: 'sin_fecha', label: 'Sin fecha base', match: (valor) => valor === null },
  ]);
}

function construirDistribucionPorDiasRestantes(tramites: TramiteFaseLegalDM[]): DistribucionLegalItem[] {
  return contarPorRango(tramites, (tramite) => tramite.diasRestantes, [
    { key: 'vencido', label: 'Vencidos', match: (valor) => valor !== null && valor < 0 },
    { key: '0-3', label: '0-3 días', match: (valor) => valor !== null && valor >= 0 && valor <= 3 },
    { key: '4-7', label: '4-7 días', match: (valor) => valor !== null && valor >= 4 && valor <= 7 },
    { key: '8-15', label: '8-15 días', match: (valor) => valor !== null && valor >= 8 && valor <= 15 },
    { key: '15+', label: 'Más de 15', match: (valor) => valor !== null && valor > 15 },
    { key: 'sin_fecha', label: 'Sin fecha probable', match: (valor) => valor === null },
  ]);
}

function construirAlertasLegal(tramites: TramiteFaseLegalDM[]) {
  const porDiasLegal = [...tramites].sort((a, b) => (b.diasEnLegal ?? -1) - (a.diasEnLegal ?? -1));
  return {
    vencidos: tramites.filter((tramite) => tramite.condicion === 'vencido'),
    proximos: tramites.filter((tramite) => tramite.condicion === 'por_vencer'),
    sinFechaProbable: tramites.filter((tramite) => tramite.condicion === 'sin_fecha_probable'),
    margenCritico: tramites.filter((tramite) => tramite.margenCriticoDesdeTecnica),
    mayorDiasLegal: porDiasLegal.filter((tramite) => tramite.diasEnLegal !== null).slice(0, 20),
  };
}

export function normalizarTramitesFaseLegalDM(params: {
  registros: TramiteFaseLegalRaw[];
  fuenteDatos: FuenteDatosLegal;
  urlConsultada?: string;
  statusHttp?: number;
  fechaActualizacion?: Date;
}): RespuestaFaseLegalDM {
  const hoy = params.fechaActualizacion || new Date();
  const tramites = params.registros.map((raw, index) => {
    const expediente =
      valorTexto(valorCampo(raw, ['codigo_codificador', 'codigo codificador', 'EXPEDIENTE', 'Numero de tramite'])) ||
      `DM-LEGAL-SIN-CODIGO-${index + 1}`;
    // La API legal trae `fecha_inicio`; se usa como fecha base de ingreso a legal.
    // Si cambia el nombre del campo, se toma una variante equivalente y se registra la fuente.
    const fechaIngresoCandidatos: Array<[string, unknown]> = [
      ['fecha_inicio', valorCampo(raw, ['fecha_inicio', 'Fecha de inicio', 'FECHA INICIO'])],
      ['fecha_ingreso_legal', valorCampo(raw, ['fecha_ingreso_legal', 'Fecha ingreso legal'])],
      ['fecha_revision_legal', valorCampo(raw, ['fecha_revision_legal', 'FECHA REV LEGAL'])],
    ];
    const fechaIngresoSeleccionada = fechaIngresoCandidatos.find(([, valor]) =>
      Boolean(parseFecha(valor))
    );
    const fechaIngresoLegal = parseFecha(fechaIngresoSeleccionada?.[1]);
    const fechaProbableSalida = parseFecha(
      valorCampo(raw, ['fecha_fin_esperada', 'Fecha fin esperada', 'fecha probable salida', 'FECHA PROBABLE DE SALIDA'])
    );
    const diasEnLegal = calcularDias(fechaIngresoLegal, hoy);
    const diasRestantes = calcularDias(hoy, fechaProbableSalida);
    const diasResolucion = valorNumero(valorCampo(raw, ['dias_resolucion', 'DIAS RESOLUCION', 'días resolución']));
    const condicion = clasificarCondicion(fechaProbableSalida, hoy);
    const margenCriticoDesdeTecnica =
      diasRestantes !== null && diasRestantes <= 1;
    const enPlazo = condicion === 'en_tiempo';
    const fuenteFechaBase = fechaIngresoLegal
      ? fechaIngresoSeleccionada?.[0] || 'fecha_inicio'
      : 'No disponible';

    return {
      id: expediente,
      expediente,
      tramite: valorTexto(valorCampo(raw, ['titulo_tramite', 'TRAMITE', 'Nombre del servicio'])) || 'No disponible',
      oficialLegal: valorTexto(valorCampo(raw, ['nombre_completo', 'responsable', 'oficial legal'])) || 'No disponible',
      emailOficial: valorTexto(valorCampo(raw, ['email', 'correo'])),
      estado: valorTexto(valorCampo(raw, ['estado', 'ESTADO'])) || 'No disponible',
      fase: valorTexto(valorCampo(raw, ['nombre_fase', 'Nombre de fase', 'fase'])) || 'No disponible',
      fechaIngresoLegal,
      fuenteFechaIngresoLegal: fuenteFechaBase,
      fuenteFechaBase,
      fechaProbableSalida,
      diasResolucion,
      diasLegal: diasEnLegal,
      diasEnLegal,
      diasRestantes,
      bucketDiasResolucion: obtenerBucketDiasResolucion(diasResolucion),
      condicion,
      margenCritico: margenCriticoDesdeTecnica,
      margenCriticoDesdeTecnica,
      enPlazo,
      direccion: 'DM',
      codigoInterno: expediente,
    } satisfies TramiteFaseLegalDM;
  });

  const cargaPorOficial = construirCargaPorOficial(tramites);
  const metricas = calcularMetricas(tramites, cargaPorOficial);
  const alertasLegal = construirAlertasLegal(tramites);
  const oficialMayorCarga = cargaPorOficial[0] || null;

  return {
    tramites,
    cargaPorOficial,
    matrizOficialLegal: cargaPorOficial,
    distribucionPorCondicion: construirDistribucionPorCondicion(tramites),
    distribucionPorDiasLegal: construirDistribucionPorDiasLegal(tramites),
    distribucionPorDiasRestantes: construirDistribucionPorDiasRestantes(tramites),
    alertasLegal,
    prioridadOperativaLegal: {
      vencidos: metricas.vencidos,
      proximos: metricas.proximosAVencer,
      margenCritico: metricas.margenCriticoDesdeTecnica,
      sinFechaProbable: metricas.sinFechaProbable,
      mayorCargaOficial: oficialMayorCarga?.oficialLegal || null,
      mayorCargaTotal: oficialMayorCarga?.total || 0,
      mayorDiasEnLegal: metricas.mayorDiasEnLegal,
    },
    metricas,
    fechaActualizacion: hoy,
    fuenteDatos: params.fuenteDatos,
    datosCrudos: params.registros,
    totalRegistrosRecibidos: params.registros.length,
    urlConsultada: params.urlConsultada,
    statusHttp: params.statusHttp,
  };
}
