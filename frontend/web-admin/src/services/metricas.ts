import {
  CargaColaborador,
  FaseTramite,
  MetricasDashboard,
  RespuestaTramitesNormalizada,
  RetrasoPorFasePersona,
  TramiteNormalizado,
} from '../types/sol';

const MS_DIA = 1000 * 60 * 60 * 24;

function inicioDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function estaEntre(fecha: Date, inicio: Date, fin: Date): boolean {
  const tiempo = inicioDia(fecha).getTime();
  return tiempo >= inicioDia(inicio).getTime() && tiempo <= inicioDia(fin).getTime();
}

function mismaFecha(fecha: Date | undefined, referencia: Date): boolean {
  return fecha
    ? inicioDia(fecha).getTime() === inicioDia(referencia).getTime()
    : false;
}

function promedio(valores: number[]): number | undefined {
  const validos = valores.filter((valor) => Number.isFinite(valor));
  if (validos.length === 0) return undefined;
  return Math.round(
    (validos.reduce((sum, valor) => sum + valor, 0) / validos.length) * 10
  ) / 10;
}

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

function contarPlazo(tramites: TramiteNormalizado[], plazo: number): number {
  return tramites.filter((tramite) => tramite.plazoDias === plazo).length;
}

function contarCortoPlazo(carga: CargaColaborador): number {
  return carga.tramitesPlazo5 + carga.tramitesPlazo10 + carga.tramitesPlazo15;
}

function construirCargaDetallada(
  tramitesAsignados: TramiteNormalizado[],
  tramitesCambioHoy: TramiteNormalizado[],
  rol: 'tecnica' | 'legal'
): CargaColaborador[] {
  const grupos = new Map<string, TramiteNormalizado[]>();

  tramitesAsignados.forEach((tramite) => {
    const colaborador = rol === 'tecnica' ? tramite.colaboradorTecnico : tramite.colaboradorLegal;
    if (!colaborador) return;
    if (!grupos.has(colaborador)) {
      grupos.set(colaborador, []);
    }
    grupos.get(colaborador)?.push(tramite);
  });

  tramitesCambioHoy.forEach((tramite) => {
    const colaborador = rol === 'tecnica' ? tramite.colaboradorTecnico : tramite.colaboradorLegal;
    if (!colaborador || grupos.has(colaborador)) return;
    grupos.set(colaborador, []);
  });

  return Array.from(grupos.entries())
    .map(([colaborador, asignados]) => {
      const diasResolucion = asignados
        .map((tramite) => tramite.plazoDias)
        .filter((valor): valor is number => valor !== undefined);
      const totalDiasResolucion = diasResolucion.reduce(
        (sum, valor) => sum + valor,
        0
      );

      return {
        colaborador,
        rol,
        cantidadTramites: asignados.length,
        totalDiasResolucion,
        promedioDiasResolucion: promedio(diasResolucion),
        tramitesPlazo5: contarPlazo(asignados, 5),
        tramitesPlazo10: contarPlazo(asignados, 10),
        tramitesPlazo15: contarPlazo(asignados, 15),
        tramitesPlazoMayor: asignados.filter(
          (tramite) => (tramite.plazoDias || 0) > 15
        ).length,
        tramitesPlazoNoDefinido: asignados.filter(
          (tramite) => tramite.plazoDias === undefined
        ).length,
        cambiosHoy: tramitesCambioHoy.filter((tramite) => {
          const responsable =
            rol === 'tecnica' ? tramite.colaboradorTecnico : tramite.colaboradorLegal;
          return responsable === colaborador;
        }).length,
        tramitesVencidos: asignados.filter((tramite) => tramite.estado === 'vencido').length,
        tramitesProximosAVencer: asignados.filter(
          (tramite) => tramite.estado === 'por_vencer'
        ).length,
        tramitesEnTecnica: asignados.filter((tramite) => tramite.faseActual === 'tecnica').length,
        tramitesEnLegal: asignados.filter((tramite) => tramite.faseActual === 'legal').length,
        promedioDiasFaseTecnica: promedio(
          asignados
            .map((tramite) => tramite.diasEnFaseTecnica)
            .filter((valor): valor is number => valor !== undefined)
        ),
        promedioDiasFaseLegal: promedio(
          asignados
            .map((tramite) => tramite.diasEnFaseLegal)
            .filter((valor): valor is number => valor !== undefined)
        ),
      };
    })
    .sort((a, b) => {
      if (b.tramitesVencidos !== a.tramitesVencidos) {
        return b.tramitesVencidos - a.tramitesVencidos;
      }
      if (b.tramitesProximosAVencer !== a.tramitesProximosAVencer) {
        return b.tramitesProximosAVencer - a.tramitesProximosAVencer;
      }
      if (contarCortoPlazo(b) !== contarCortoPlazo(a)) {
        return contarCortoPlazo(b) - contarCortoPlazo(a);
      }
      if (b.cantidadTramites !== a.cantidadTramites) {
        return b.cantidadTramites - a.cantidadTramites;
      }
      return b.totalDiasResolucion - a.totalDiasResolucion;
    });
}

function construirRankingRetraso(tramites: TramiteNormalizado[]): RetrasoPorFasePersona[] {
  const grupos = new Map<string, number[]>();

  const agregar = (
    colaborador: string | undefined,
    fase: FaseTramite,
    dias: number | undefined
  ) => {
    if (!colaborador || dias === undefined || dias <= 0) return;
    const clave = `${colaborador}__${fase}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)?.push(dias);
  };

  tramites.forEach((tramite) => {
    agregar(tramite.colaboradorTecnico, 'tecnica', tramite.diasEnFaseTecnica);
    agregar(tramite.colaboradorLegal, 'legal', tramite.diasEnFaseLegal);
  });

  return Array.from(grupos.entries())
    .map(([clave, dias]) => {
      const [colaborador, fase] = clave.split('__') as [string, FaseTramite];
      return {
        colaborador,
        fase,
        cantidadTramites: dias.length,
        promedioDias: promedio(dias) || 0,
        maxDias: Math.max(...dias),
      };
    })
    .sort((a, b) => b.promedioDias - a.promedioDias);
}

export function calcularMetricasDashboard(
  respuesta: RespuestaTramitesNormalizada
): MetricasDashboard {
  if (!respuesta || !respuesta.tramites) return {} as MetricasDashboard;

  const tramites = respuesta.tramites;
  const hoy = inicioDia(tramites.find((t) => t.fecha_hoy)?.fecha_hoy || new Date());
  const finProximosTresDias = new Date(hoy.getTime() + 3 * MS_DIA);

  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay());

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const tramitesGestion = tramites.filter((t) => t.enGestion);
  const tramitesEnSAC = tramites.filter((t) => t.enSAC).length;
  const activos = tramitesGestion.filter((t) => !t.fechaFinalizacion);
  const finalizados = tramitesGestion.filter((t) => Boolean(t.fechaFinalizacion));

  const finalizadosHoy = finalizados.filter((t) =>
    t.fechaFinalizacion
      ? inicioDia(t.fechaFinalizacion).getTime() === hoy.getTime()
      : false
  ).length;

  const finalizadosEstaSemana = finalizados.filter((t) =>
    t.fechaFinalizacion
      ? estaEntre(t.fechaFinalizacion, inicioSemana, hoy)
      : false
  ).length;

  const finalizadosEsteMes = finalizados.filter((t) =>
    t.fechaFinalizacion
      ? estaEntre(t.fechaFinalizacion, inicioMes, finMes)
      : false
  ).length;

  const vencidos = activos.filter(
    (t) => t.fechaVencimiento && inicioDia(t.fechaVencimiento) < hoy
  ).length;

  const porVencer = activos.filter(
    (t) =>
      t.fechaVencimiento &&
      estaEntre(t.fechaVencimiento, hoy, finProximosTresDias)
  ).length;

  const requeridosAlCiudadano = tramitesGestion.filter(
    (t) => t.estado === 'requerido'
  ).length;
  const tramitesEnFaseTecnica = activos.filter((t) => t.faseActual === 'tecnica').length;
  const tramitesEnFaseLegal = activos.filter((t) => t.faseActual === 'legal').length;
  const tramitesEnLegal = activos.filter((t) => t.faseActual === 'legal');
  const tramitesEnTecnica = activos.filter((t) => t.faseActual === 'tecnica');
  const cambiosTecnicaALegalHoy = tramitesGestion.filter((t) =>
    mismaFecha(t.fecha_revision_tecnica, hoy)
  );
  const cambiosLegalHoy = tramitesGestion.filter(
    (t) => mismaFecha(t.fechaFinalizacion, hoy) || mismaFecha(t.fecha_emision, hoy)
  );

  const sinAsignar = activos.filter((t) => !t.colaboradorTecnico).length;

  const tramiteCriticos = tramitesGestion.filter(
    (t) => t.riesgo === 'alto' || t.riesgo === 'medio' || t.estado === 'requerido'
  );

  const cargaPorColaborador: Record<string, number> = {};
  tramitesGestion.forEach((t) => {
    const colaborador = t.personaAsignada;
    if (!colaborador) return;
    cargaPorColaborador[colaborador] =
      (cargaPorColaborador[colaborador] || 0) + 1;
  });
  const cargaTecnica = construirCargaDetallada(
    tramitesEnTecnica,
    cambiosTecnicaALegalHoy,
    'tecnica'
  );
  const cargaLegal = construirCargaDetallada(tramitesEnLegal, cambiosLegalHoy, 'legal');
  const cargaDetalladaPorColaborador = [...cargaTecnica, ...cargaLegal].sort(
    (a, b) => {
      if (b.totalDiasResolucion !== a.totalDiasResolucion) {
        return b.totalDiasResolucion - a.totalDiasResolucion;
      }
      return b.cantidadTramites - a.cantidadTramites;
    }
  );
  const rankingRetrasoPorFasePersona = construirRankingRetraso(tramitesGestion);

  const tramitesConFaseTecnica = tramitesGestion.filter(
    (t) => t.diasEnFaseTecnica && t.diasEnFaseTecnica > 0
  );
  const tiempoPromedioFaseTecnica =
    tramitesConFaseTecnica.length > 0
      ? tramitesConFaseTecnica.reduce(
          (sum, t) => sum + (t.diasEnFaseTecnica || 0),
          0
        ) / tramitesConFaseTecnica.length
      : 0;
  const tramitesConFaseLegal = tramitesGestion.filter(
    (t) => t.diasEnFaseLegal && t.diasEnFaseLegal > 0
  );
  const tiempoPromedioFaseLegal =
    tramitesConFaseLegal.length > 0
      ? tramitesConFaseLegal.reduce(
          (sum, t) => sum + (t.diasEnFaseLegal || 0),
          0
        ) / tramitesConFaseLegal.length
      : 0;

  return {
    tramitesActivosDM: activos.length,
    tramitesFinalizados: finalizados.length,
    finalizadosHoy,
    finalizadosEstaSemana,
    finalizadosEsteMes,
    vencidos,
    porVencer,
    requeridosAlCiudadano,
    sinAsignar,
    tiempoPromedioFaseTecnica: redondear(tiempoPromedioFaseTecnica),
    tiempoPromedioFaseLegal: redondear(tiempoPromedioFaseLegal),
    tramitesEnFaseTecnica,
    tramitesEnFaseLegal,
    tramiteCriticos,
    cargaPorColaborador,
    cargaDetalladaPorColaborador,
    cargaTecnica,
    cargaLegal,
    rankingCargaPorPersona: cargaDetalladaPorColaborador,
    rankingRetrasoPorFasePersona,
    tramitesEnLegal,
    tramitesEnSAC,
  };
}

export function filtrarTramitesPorEstado(
  tramites: TramiteNormalizado[],
  estado: string
): TramiteNormalizado[] {
  return tramites.filter((t) => t.estado === estado);
}

export function filtrarTramitesPorFase(
  tramites: TramiteNormalizado[],
  fase: string
): TramiteNormalizado[] {
  return tramites.filter((t) => t.faseActual === fase);
}

export function filtrarTramitesPorColaborador(
  tramites: TramiteNormalizado[],
  colaborador: string
): TramiteNormalizado[] {
  return tramites.filter(
    (t) =>
      t.colaboradorTecnico === colaborador ||
      t.colaboradorLegal === colaborador
  );
}
