import type { jsPDF } from 'jspdf';
import { renderEventMap } from './renderEventMap';

export type DashboardPdfEvent = Record<string, unknown>;

export type DashboardPdfFilter = {
  label: string;
  value: string;
};

type DashboardPdfOptions = {
  events: DashboardPdfEvent[];
  filename: string;
  filters: DashboardPdfFilter[];
  title: string;
};

type DashboardPdfBuildOptions = DashboardPdfOptions & {
  mapImage?: string | null;
};

type CountDatum = { label: string; value: number };

const PAGE_MARGIN = 12;
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 297;
const COLORS = ['#1677d2', '#00a6a6', '#f59e0b', '#e05666', '#7c5cc4', '#4f9d69', '#d97706', '#0891b2', '#be185d', '#64748b'];

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalize(value: unknown) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function firstText(event: DashboardPdfEvent, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = text(event[key]);
    if (value) return value;
  }
  return fallback;
}

function provinceOf(event: DashboardPdfEvent) {
  return firstText(event, ['provincia_nombre', 'provincia'], 'Sin provincia');
}

function cantonOf(event: DashboardPdfEvent) {
  return firstText(event, ['canton_nombre', 'canton']);
}

function parishOf(event: DashboardPdfEvent) {
  return firstText(event, ['parroquia_nombre', 'parroquia']);
}

function venueOf(event: DashboardPdfEvent) {
  return firstText(event, ['infraestructura_nombre', 'infraestructura', 'infraestructura_id']);
}

function eventTypeOf(event: DashboardPdfEvent) {
  return firstText(event, ['evento_tipo_nombre', 'tipo'], 'Sin evento');
}

function statusOf(event: DashboardPdfEvent) {
  return firstText(event, [
    'evento_atencion_estado_nombre', 'atencion_estado_nombre', 'evento_atencion_estado', 'atencion_estado',
    'evento_estado_nombre', 'estado_nombre', 'evento_estado', 'estado',
  ], 'Sin estado');
}

function simulatedOf(event: DashboardPdfEvent) {
  const value = event.alto_impacto;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value !== 0 ? 'Sí' : 'No';
  return ['true', '1', 'si'].includes(normalize(value)) ? 'Sí' : 'No';
}

function eventDateOf(event: DashboardPdfEvent) {
  const value = firstText(event, ['evento_fecha', 'fecha_evento', 'creacion']);
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function countBy(events: DashboardPdfEvent[], labelOf: (event: DashboardPdfEvent) => string) {
  const counts = new Map<string, number>();
  events.forEach((event) => {
    const label = labelOf(event);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts, ([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value);
}

function fitText(pdf: jsPDF, value: string, maxWidth: number) {
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let shortened = value;
  while (shortened.length > 1 && pdf.getTextWidth(`${shortened}…`) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function drawPanel(pdf: jsPDF, x: number, y: number, width: number, height: number, title: string) {
  pdf.setFillColor('#ffffff');
  pdf.setDrawColor('#dbe6f3');
  pdf.roundedRect(x, y, width, height, 3, 3, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14.5);
  pdf.setTextColor('#153b62');
  pdf.text(title, x + 5, y + 9);
}

function drawSummary(pdf: jsPDF, events: DashboardPdfEvent[], y: number) {
  const normalizedStatuses = events.map((event) => normalize(statusOf(event)));
  const countStatus = (matches: (status: string) => boolean) => normalizedStatuses.filter(matches).length;
  const cards = [
    { label: 'Total de eventos', value: events.length, color: '#ffffff', background: '#0b67b2', border: '#0b67b2' },
    { label: 'Atención finalizada', value: countStatus((status) => status.includes('finalizada')), color: '#16a34a', background: '#ffffff', border: '#cfe2f3' },
    { label: 'Atención iniciada', value: countStatus((status) => status.includes('iniciada')), color: '#1677d2', background: '#ffffff', border: '#cfe2f3' },
    { label: 'Atención media (en proceso)', value: countStatus((status) => status.includes('media') || status.includes('proceso')), color: '#f97316', background: '#ffffff', border: '#cfe2f3' },
    { label: 'Atención permanente', value: countStatus((status) => status.includes('permanente')), color: '#7c3aed', background: '#ffffff', border: '#cfe2f3' },
    { label: 'Atención suspendida', value: countStatus((status) => status.includes('suspendida')), color: '#ef4444', background: '#ffffff', border: '#cfe2f3' },
  ];
  const gap = 3;
  const width = (PAGE_WIDTH - PAGE_MARGIN * 2 - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (width + gap);
    pdf.setFillColor(card.background);
    pdf.setDrawColor(card.border);
    pdf.roundedRect(x, y, width, 22, 2.5, 2.5, 'FD');
    pdf.setTextColor(card.color);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    const labelLines = pdf.splitTextToSize(card.label, width - 18).slice(0, 2) as string[];
    pdf.text(labelLines, x + 4, y + 8.5, { lineHeightFactor: 1 });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(25);
    pdf.text(String(card.value), x + width - 4, y + 17, { align: 'right' });
  });
}

function drawHorizontalBars(pdf: jsPDF, data: CountDatum[], x: number, y: number, width: number, height: number) {
  drawPanel(pdf, x, y, width, height, 'Eventos por tipo');
  const rows = data;
  if (!rows.length) {
    pdf.setFontSize(8);
    pdf.setTextColor('#64748b');
    pdf.text('No existen eventos para graficar.', x + 5, y + 20);
    return;
  }
  const labelWidth = 60;
  const chartX = x + labelWidth + 7;
  const chartWidth = width - labelWidth - 16;
  const rowHeight = (height - 18) / rows.length;
  const barHeight = Math.max(1.4, Math.min(4, rowHeight * 0.48));
  const fontSize = Math.max(7, Math.min(9.5, rowHeight * 1.08));
  const max = Math.max(...rows.map((row) => row.value), 1);
  rows.forEach((row, index) => {
    const rowY = y + 15 + index * rowHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor('#334155');
    pdf.text(fitText(pdf, row.label, labelWidth), x + 5, rowY + barHeight * 0.8);
    pdf.setFillColor('#e7eef6');
    pdf.roundedRect(chartX, rowY, chartWidth, barHeight, 1, 1, 'F');
    pdf.setFillColor(COLORS[index % COLORS.length]);
    pdf.roundedRect(chartX, rowY, Math.max(2, chartWidth * row.value / max), barHeight, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(row.value), chartX + chartWidth + 2, rowY + barHeight * 0.8);
  });
}

function drawProvinceStackedChart(pdf: jsPDF, events: DashboardPdfEvent[], x: number, y: number, width: number, height: number) {
  drawPanel(pdf, x, y, width, height, 'Eventos por provincia y tipo');
  const provinces = countBy(events, provinceOf);
  const types = countBy(events, eventTypeOf).map((item) => item.label);
  if (!provinces.length) {
    pdf.setFontSize(8);
    pdf.setTextColor('#64748b');
    pdf.text('No existen provincias para graficar.', x + 5, y + 20);
    return;
  }
  const legendColumns = Math.min(3, Math.max(types.length, 1));
  const legendRows = Math.ceil(types.length / legendColumns);
  const legendHeight = legendRows * 5;
  const labelWidth = 55;
  const chartX = x + labelWidth + 7;
  const chartWidth = width - labelWidth - 16;
  const rowHeight = (height - 20 - legendHeight) / provinces.length;
  const barHeight = Math.max(1.3, Math.min(4, rowHeight * 0.48));
  const fontSize = Math.max(6.7, Math.min(9, rowHeight * 1.03));
  const max = Math.max(...provinces.map((province) => province.value), 1);
  provinces.forEach((province, index) => {
    const rowY = y + 16 + legendHeight + index * rowHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor('#334155');
    pdf.text(fitText(pdf, province.label, labelWidth), x + 5, rowY + barHeight * 0.8);
    let offset = 0;
    types.forEach((type, typeIndex) => {
      const amount = events.filter((event) => provinceOf(event) === province.label && eventTypeOf(event) === type).length;
      if (!amount) return;
      const segmentWidth = chartWidth * amount / max;
      pdf.setFillColor(COLORS[typeIndex % COLORS.length]);
      pdf.rect(chartX + offset, rowY, segmentWidth, barHeight, 'F');
      offset += segmentWidth;
    });
  });
  types.forEach((type, index) => {
    const legendWidth = (width - 10) / legendColumns;
    const legendX = x + 5 + (index % legendColumns) * legendWidth;
    const legendY = y + 15 + Math.floor(index / legendColumns) * 5;
    pdf.setFillColor(COLORS[index % COLORS.length]);
    pdf.circle(legendX + 1.5, legendY, 1.5, 'F');
    pdf.setFontSize(8.5);
    pdf.setTextColor('#475569');
    pdf.text(fitText(pdf, type, legendWidth - 6), legendX + 5, legendY + 1.5);
  });
}

function drawHeader(pdf: jsPDF, title: string, filters: DashboardPdfFilter[]) {
  pdf.setFillColor('#083b66');
  pdf.rect(0, 0, PAGE_WIDTH, 27, 'F');
  pdf.setFillColor('#11a7b5');
  pdf.rect(0, 24, PAGE_WIDTH, 3, 'F');
  pdf.setTextColor('#ffffff');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text(title, PAGE_MARGIN, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const filterText = filters.filter((filter) => filter.value).map((filter) => `${filter.label}: ${filter.value}`).join('   |   ');
  pdf.text(fitText(pdf, filterText || 'Sin filtros aplicados', PAGE_WIDTH - PAGE_MARGIN * 2), PAGE_MARGIN, 20);
}

function tableRows(events: DashboardPdfEvent[]) {
  return events.map((event, index) => [
    index + 1,
    provinceOf(event),
    cantonOf(event),
    parishOf(event),
    venueOf(event),
    firstText(event, ['sector']),
    eventTypeOf(event),
    simulatedOf(event),
    eventDateOf(event),
    statusOf(event),
    firstText(event, ['situacion']),
    firstText(event, ['descripcion', 'observacion']),
  ]);
}

export async function createDashboardPdf({ events, filters, title, mapImage = null }: DashboardPdfBuildOptions) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });

  drawHeader(pdf, title, filters);
  drawSummary(pdf, events, 33);
  const eventTypes = countBy(events, eventTypeOf);
  const provinces = countBy(events, provinceOf);
  const contentY = 61;
  const contentHeight = 216;
  const contentGap = 6;
  const leftWidth = 190;
  const mapX = PAGE_MARGIN + leftWidth + contentGap;
  const mapWidth = PAGE_WIDTH - PAGE_MARGIN - mapX;
  const chartSpace = contentHeight - contentGap;
  const eventWeight = Math.max(6, eventTypes.length + 2);
  const provinceWeight = Math.max(7, provinces.length + Math.ceil(eventTypes.length / 3) + 2);
  const proportionalEventHeight = chartSpace * eventWeight / (eventWeight + provinceWeight);
  const eventChartHeight = Math.max(62, Math.min(chartSpace - 72, proportionalEventHeight));
  const provinceChartHeight = chartSpace - eventChartHeight;

  drawHorizontalBars(pdf, eventTypes, PAGE_MARGIN, contentY, leftWidth, eventChartHeight);
  drawProvinceStackedChart(pdf, events, PAGE_MARGIN, contentY + eventChartHeight + contentGap, leftWidth, provinceChartHeight);
  drawPanel(pdf, mapX, contentY, mapWidth, contentHeight, 'Mapa de eventos registrados');
  if (mapImage) {
    pdf.addImage(mapImage, 'JPEG', mapX + 4, contentY + 11, mapWidth - 8, contentHeight - 16, undefined, 'FAST');
  } else {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor('#64748b');
    pdf.text('No existen coordenadas válidas para generar el mapa.', mapX + 6, contentY + 21);
  }

  pdf.addPage('a3', 'landscape');
  autoTable(pdf, {
    startY: 26,
    margin: { top: 26, right: 8, bottom: 12, left: 8 },
    theme: 'grid',
    head: [[
      '#', 'Provincia', 'Cantón', 'Parroquia', 'Recinto', 'Sector', 'Evento', 'Simulado',
      'Fecha', 'Estado', 'Situación actual', 'Descripción general',
    ]],
    body: tableRows(events),
    styles: { font: 'helvetica', fontSize: 6.3, cellPadding: 1.5, overflow: 'linebreak', valign: 'top', textColor: '#24384b' },
    headStyles: { fillColor: '#0b5ea8', textColor: '#ffffff', fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: '#f4f8fc' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 24 }, 2: { cellWidth: 23 },
      3: { cellWidth: 23 }, 4: { cellWidth: 31 }, 5: { cellWidth: 22 }, 6: { cellWidth: 28 },
      7: { cellWidth: 14, halign: 'center' }, 8: { cellWidth: 24 }, 9: { cellWidth: 25 },
      10: { cellWidth: 89 }, 11: { cellWidth: 93 },
    },
    didDrawPage: () => {
      pdf.setFillColor('#083b66');
      pdf.rect(0, 0, PAGE_WIDTH, 20, 'F');
      pdf.setTextColor('#ffffff');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(`Detalle completo de eventos (${events.length})`, 8, 13);
    },
  });

  const generatedAt = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor('#64748b');
    pdf.text(`CNE - Generado: ${generatedAt}`, PAGE_MARGIN, PAGE_HEIGHT - 5);
    pdf.text(`Página ${page} de ${totalPages}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 5, { align: 'right' });
  }

  return pdf;
}

export async function exportDashboardToPdf(options: DashboardPdfOptions) {
  const mapImage = await renderEventMap(options.events);
  const pdf = await createDashboardPdf({ ...options, mapImage });
  pdf.save(options.filename);
}
