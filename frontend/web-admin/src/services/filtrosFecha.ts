import {
  DiagnosticoFechas,
  FiltroFechaDashboard,
  PeriodoFiltro,
  RespuestaTramitesNormalizada,
  TramiteNormalizado,
} from '../types/sol';

function inicioDelDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function finDelDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

export function formatoInputFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function crearFiltroInicial(): FiltroFechaDashboard {
  return crearFiltroPorPeriodo('mes');
}

export function crearFiltroPorPeriodo(
  periodo: PeriodoFiltro,
  fechaReferencia: Date = new Date()
): FiltroFechaDashboard {
  const hoy = inicioDelDia(fechaReferencia);

  if (periodo === 'hoy') {
    return {
      periodo,
      fechaInicio: hoy,
      fechaFin: finDelDia(hoy),
      incluirSinFecha: false,
    };
  }

  if (periodo === 'semana') {
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    return {
      periodo,
      fechaInicio: inicioSemana,
      fechaFin: finDelDia(hoy),
      incluirSinFecha: false,
    };
  }

  if (periodo === 'mes') {
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return {
      periodo,
      fechaInicio: inicioMes,
      fechaFin: finDelDia(finMes),
      incluirSinFecha: false,
    };
  }

  if (periodo === 'mes_anterior') {
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return {
      periodo,
      fechaInicio: inicioMesAnterior,
      fechaFin: finDelDia(finMesAnterior),
      incluirSinFecha: false,
    };
  }

  return {
    periodo,
    incluirSinFecha: periodo === 'historico' ? false : false,
  };
}

export function crearFiltroPersonalizado(
  fechaInicio: string,
  fechaFin: string,
  incluirSinFecha: boolean
): FiltroFechaDashboard {
  return {
    periodo: 'personalizado',
    fechaInicio: inicioDelDia(new Date(`${fechaInicio}T00:00:00`)),
    fechaFin: finDelDia(new Date(`${fechaFin}T00:00:00`)),
    incluirSinFecha,
  };
}

export function describirPeriodo(filtro: FiltroFechaDashboard): string {
  if (filtro.periodo === 'historico') {
    return 'Todo el histórico';
  }

  if (!filtro.fechaInicio || !filtro.fechaFin) {
    return 'Rango no definido';
  }

  return `${filtro.fechaInicio.toLocaleDateString(
    'es-HN'
  )} al ${filtro.fechaFin.toLocaleDateString('es-HN')}`;
}

export function filtrarTramitesPorFecha(
  tramites: TramiteNormalizado[],
  filtro: FiltroFechaDashboard
): TramiteNormalizado[] {
  return tramites.filter((tramite) => {
    if (!tramite.fechaBase) {
      return filtro.periodo === 'historico' || filtro.incluirSinFecha;
    }

    if (filtro.periodo === 'historico') {
      return true;
    }

    if (!filtro.fechaInicio || !filtro.fechaFin) {
      return false;
    }

    const fechaBase = tramite.fechaBase.getTime();
    return (
      fechaBase >= filtro.fechaInicio.getTime() &&
      fechaBase <= filtro.fechaFin.getTime()
    );
  });
}

export function aplicarFiltroFecha(
  datos: RespuestaTramitesNormalizada,
  filtro: FiltroFechaDashboard
): RespuestaTramitesNormalizada {
  const tramites = filtrarTramitesPorFecha(datos.tramites, filtro);

  return {
    ...datos,
    tramites,
    total_registros: tramites.length,
  };
}

export function obtenerDiagnosticoFechas(
  tramites: TramiteNormalizado[]
): DiagnosticoFechas {
  const camposFechaBase: Record<string, number> = {};
  const fechasValidas: Date[] = [];

  tramites.forEach((tramite) => {
    if (tramite.fechaBase && tramite.campoFechaBase) {
      camposFechaBase[tramite.campoFechaBase] =
        (camposFechaBase[tramite.campoFechaBase] || 0) + 1;
      fechasValidas.push(tramite.fechaBase);
    }
  });

  const fechasOrdenadas = fechasValidas.sort(
    (a, b) => a.getTime() - b.getTime()
  );

  return {
    camposFechaBase,
    tramitesConFechaValida: fechasValidas.length,
    tramitesSinFecha: tramites.length - fechasValidas.length,
    fechaMinima: fechasOrdenadas[0],
    fechaMaxima: fechasOrdenadas[fechasOrdenadas.length - 1],
  };
}
