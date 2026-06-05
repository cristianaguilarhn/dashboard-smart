import { TramiteNormalizado } from '../types/sol';

function formatearFecha(fecha?: Date): string {
  return fecha ? fecha.toLocaleDateString('es-HN') : '';
}

function limpiarValorCsv(valor: string | number | undefined): string {
  const texto = String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

function formatearNumero(valor?: number): string {
  return valor === undefined || Number.isNaN(valor) ? 'No definido' : String(valor);
}

function formatearTrazabilidad(tramite: TramiteNormalizado, valor?: number): string {
  if (valor !== undefined) return String(valor);
  return tramite.diagnosticoTrazabilidad || 'Sin trazabilidad suficiente';
}

export function exportarTramitesExcel(
  nombreArchivo: string,
  tramites: TramiteNormalizado[]
): void {
  const encabezados = [
    'Expediente',
    'Tramite',
    'Persona asignada',
    'Fase actual',
    'Estado final',
    'Fecha de inicio',
    'Fecha probable de salida',
    'Fecha de finalizacion',
    'Dias resolucion',
    'Dias transcurridos',
    'Dias restantes',
    'Tiempo fase tecnica',
    'Tiempo fase legal',
    'Responsable tecnico',
    'Responsable legal',
  ];

  const filas = tramites.map((tramite) => [
    tramite.numeroTramite || tramite.id,
    tramite.descripcion,
    tramite.personaAsignada || 'Sin asignar',
    tramite.faseActual,
    tramite.estado_final || tramite.estado_actual || tramite.estado,
    formatearFecha(tramite.fecha_inicio_gestion),
    formatearFecha(tramite.fechaVencimiento),
    formatearFecha(tramite.fechaFinalizacion),
    formatearNumero(tramite.plazoDias),
    formatearNumero(tramite.diasTranscurridos),
    formatearNumero(tramite.diasRestantes),
    formatearTrazabilidad(tramite, tramite.diasEnFaseTecnica),
    formatearTrazabilidad(tramite, tramite.diasEnFaseLegal),
    tramite.colaboradorTecnico || 'Sin asignar',
    tramite.colaboradorLegal || 'Sin asignar',
  ]);

  const contenido = [encabezados, ...filas]
    .map((fila) => fila.map(limpiarValorCsv).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${contenido}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${nombreArchivo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
