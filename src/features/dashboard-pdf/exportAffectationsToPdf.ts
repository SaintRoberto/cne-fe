import type { jsPDF } from 'jspdf';
import type { DashboardPdfFilter } from './exportDashboardToPdf';

export type AffectationPdfVariable = {
  id: string;
  label: string;
};

export type AffectationPdfRow = {
  eventCount: number;
  province: string;
  values: Record<string, number>;
};

export type AffectationPdfOptions = {
  filename: string;
  filters: DashboardPdfFilter[];
  rows: AffectationPdfRow[];
  title: string;
  variables: AffectationPdfVariable[];
};

const PAGE_MARGIN = 12;

type AffectationIcon = 'activity' | 'animal' | 'bridge' | 'building' | 'health' | 'home' | 'landmark' | 'person' | 'route' | 'sprout' | 'users' | 'vote';

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function affectationVisual(label: string): { background: string; color: string; icon: AffectationIcon } {
  const name = normalizeText(label);
  const color = name.includes('destruid') || name.includes('muert') || name.includes('fallecid')
    ? { color: '#c22117', background: '#fff0ef' }
    : name.includes('perdid') || name.includes('herid') || name.includes('quemad')
      ? { color: '#b85c00', background: '#fff4df' }
      : name.includes('cultivo') || name.includes('vegetal') || name.includes('animal') || name.includes('via') || name.includes('metro')
        ? { color: '#087f3d', background: '#eaf9ef' }
        : name.includes('recinto') || name.includes('bien')
          ? { color: '#6c2bd9', background: '#f3efff' }
          : { color: '#1268b3', background: '#eaf4ff' };

  if (name.includes('recinto')) return { ...color, icon: 'vote' };
  if (name.includes('centro') && name.includes('salud')) return { ...color, icon: 'health' };
  if (name.includes('puente')) return { ...color, icon: 'bridge' };
  if (name.includes('animal')) return { ...color, icon: 'animal' };
  if (name.includes('bien') && name.includes('public')) return { ...color, icon: 'landmark' };
  if (name.includes('bien') && name.includes('privad')) return { ...color, icon: 'building' };
  if (name.includes('cultivo') || name.includes('vegetal') || name.includes('hectarea')) return { ...color, icon: 'sprout' };
  if (name.includes('vivienda')) return { ...color, icon: 'home' };
  if (name.includes('via') || name.includes('metro')) return { ...color, icon: 'route' };
  if (name.includes('familia')) return { ...color, icon: 'users' };
  if (name.includes('persona')) return { ...color, icon: 'person' };
  if (name.includes('infraestructura') || name.includes('edific')) return { ...color, icon: 'building' };
  return { ...color, icon: 'activity' };
}

function drawAffectationIcon(pdf: jsPDF, icon: AffectationIcon, x: number, y: number, color: string) {
  pdf.setDrawColor(color);
  pdf.setLineWidth(0.55);
  if (icon === 'vote') {
    pdf.roundedRect(x + 1, y + 2.5, 8, 6, 0.8, 0.8, 'S');
    pdf.line(x + 3, y + 5.3, x + 4.2, y + 6.5);
    pdf.line(x + 4.2, y + 6.5, x + 6.7, y + 3.8);
    pdf.line(x + 2, y + 9.3, x + 8, y + 9.3);
  } else if (icon === 'health') {
    pdf.rect(x + 1.5, y + 2, 7, 7.5, 'S');
    pdf.line(x + 5, y + 3.2, x + 5, y + 6.3);
    pdf.line(x + 3.5, y + 4.75, x + 6.5, y + 4.75);
    pdf.line(x + 3, y + 9.5, x + 3, y + 7.4);
    pdf.line(x + 7, y + 9.5, x + 7, y + 7.4);
  } else if (icon === 'bridge') {
    pdf.line(x + 1, y + 5, x + 9, y + 5);
    pdf.line(x + 1, y + 8, x + 9, y + 8);
    pdf.line(x + 2, y + 4, x + 2, y + 9.3);
    pdf.line(x + 5, y + 4, x + 5, y + 9.3);
    pdf.line(x + 8, y + 4, x + 8, y + 9.3);
    pdf.line(x + 2, y + 5, x + 3.5, y + 3.5);
    pdf.line(x + 3.5, y + 3.5, x + 5, y + 5);
    pdf.line(x + 5, y + 5, x + 6.5, y + 3.5);
    pdf.line(x + 6.5, y + 3.5, x + 8, y + 5);
  } else if (icon === 'animal') {
    pdf.circle(x + 3, y + 3.4, 1, 'S');
    pdf.circle(x + 6.8, y + 3.4, 1, 'S');
    pdf.circle(x + 1.8, y + 5.7, 0.9, 'S');
    pdf.circle(x + 8, y + 5.7, 0.9, 'S');
    pdf.ellipse(x + 4.9, y + 7.5, 2.4, 1.8, 'S');
  } else if (icon === 'landmark') {
    pdf.line(x + 1, y + 4, x + 5, y + 1.8);
    pdf.line(x + 5, y + 1.8, x + 9, y + 4);
    pdf.line(x + 1, y + 4, x + 9, y + 4);
    [2.3, 5, 7.7].forEach((columnX) => pdf.line(x + columnX, y + 4.5, x + columnX, y + 8.5));
    pdf.line(x + 1, y + 9, x + 9, y + 9);
  } else if (icon === 'building') {
    pdf.rect(x + 1.5, y + 1.5, 7, 8, 'S');
    [3, 5, 7].forEach((windowX) => {
      pdf.rect(x + windowX - 0.5, y + 3, 1, 1, 'S');
      pdf.rect(x + windowX - 0.5, y + 5.5, 1, 1, 'S');
    });
  } else if (icon === 'sprout') {
    pdf.line(x + 5, y + 9.5, x + 5, y + 3.5);
    pdf.ellipse(x + 3.3, y + 4.2, 1.8, 1, 'S');
    pdf.ellipse(x + 6.7, y + 2.8, 1.8, 1, 'S');
    pdf.line(x + 2, y + 9.5, x + 8, y + 9.5);
  } else if (icon === 'home') {
    pdf.line(x + 1, y + 5, x + 5, y + 1.8);
    pdf.line(x + 5, y + 1.8, x + 9, y + 5);
    pdf.line(x + 2, y + 4.2, x + 2, y + 9.2);
    pdf.line(x + 8, y + 4.2, x + 8, y + 9.2);
    pdf.line(x + 2, y + 9.2, x + 8, y + 9.2);
    pdf.rect(x + 4, y + 6.2, 2, 3, 'S');
  } else if (icon === 'route') {
    pdf.line(x + 3, y + 1.5, x + 2.2, y + 4);
    pdf.line(x + 2.2, y + 4, x + 3, y + 6.5);
    pdf.line(x + 3, y + 6.5, x + 2.2, y + 9.5);
    pdf.line(x + 7, y + 1.5, x + 7.8, y + 4);
    pdf.line(x + 7.8, y + 4, x + 7, y + 6.5);
    pdf.line(x + 7, y + 6.5, x + 7.8, y + 9.5);
    pdf.line(x + 5, y + 2, x + 5, y + 3.5);
    pdf.line(x + 5, y + 5, x + 5, y + 6.5);
    pdf.line(x + 5, y + 8, x + 5, y + 9.5);
  } else if (icon === 'users') {
    pdf.circle(x + 3.2, y + 3.4, 1.3, 'S');
    pdf.circle(x + 6.8, y + 3.4, 1.3, 'S');
    pdf.ellipse(x + 3.2, y + 7.2, 2.1, 2.2, 'S');
    pdf.ellipse(x + 6.8, y + 7.2, 2.1, 2.2, 'S');
  } else if (icon === 'person') {
    pdf.circle(x + 5, y + 3, 1.5, 'S');
    pdf.line(x + 5, y + 4.5, x + 5, y + 7);
    pdf.line(x + 5, y + 5.5, x + 2.8, y + 7);
    pdf.line(x + 5, y + 5.5, x + 7.2, y + 7);
    pdf.line(x + 5, y + 7, x + 3.5, y + 9.5);
    pdf.line(x + 5, y + 7, x + 6.5, y + 9.5);
  } else {
    pdf.line(x + 1, y + 6, x + 3, y + 6);
    pdf.line(x + 3, y + 6, x + 4, y + 2.5);
    pdf.line(x + 4, y + 2.5, x + 5.5, y + 9);
    pdf.line(x + 5.5, y + 9, x + 7, y + 5);
    pdf.line(x + 7, y + 5, x + 9, y + 5);
  }
}

function fitText(pdf: jsPDF, value: string, maxWidth: number) {
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let shortened = value;
  while (shortened.length > 1 && pdf.getTextWidth(`${shortened}…`) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function drawHeader(pdf: jsPDF, title: string, filters: DashboardPdfFilter[]) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFillColor('#083b66');
  pdf.rect(0, 0, pageWidth, 27, 'F');
  pdf.setFillColor('#11a7b5');
  pdf.rect(0, 24, pageWidth, 3, 'F');
  pdf.setTextColor('#ffffff');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text(title, PAGE_MARGIN, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const filterText = filters.map((filter) => `${filter.label}: ${filter.value}`).join('  |  ');
  pdf.text(fitText(pdf, filterText || 'Sin filtros aplicados', pageWidth - PAGE_MARGIN * 2), PAGE_MARGIN, 20);
}

function drawAffectationSummary(pdf: jsPDF, rows: AffectationPdfRow[], variables: AffectationPdfVariable[]) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const panelX = PAGE_MARGIN;
  const panelY = 33;
  const panelWidth = pageWidth - PAGE_MARGIN * 2;
  const columns = 6;
  const gap = 3;
  const cardHeight = 18;
  const cardWidth = (panelWidth - 8 - gap * (columns - 1)) / columns;
  const variableRows = Math.max(1, Math.ceil(variables.length / columns));
  const variablesPanelHeight = 14 + variableRows * cardHeight + Math.max(0, variableRows - 1) * gap + 6;
  const variableTotals = new Map(variables.map((variable) => [
    variable.id,
    rows.reduce((sum, row) => sum + Number(row.values[variable.id] || 0), 0),
  ]));

  pdf.setFillColor('#ffffff');
  pdf.setDrawColor('#cbddeb');
  pdf.roundedRect(panelX, panelY, panelWidth, variablesPanelHeight, 2.5, 2.5, 'FD');
  pdf.setFillColor('#1677d2');
  pdf.roundedRect(panelX + 4, panelY + 4, 2, 7, 1, 1, 'F');
  pdf.setTextColor('#0f172a');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Variables de afectación', panelX + 9, panelY + 9);

  variables.forEach((variable, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = panelX + 4 + column * (cardWidth + gap);
    const y = panelY + 14 + row * (cardHeight + gap);
    const visual = affectationVisual(variable.label);
    pdf.setFillColor('#f7f9fc');
    pdf.setDrawColor('#d8e5f0');
    pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
    pdf.setFillColor(visual.background);
    pdf.roundedRect(x + 2, y + 4, 11, 11, 2, 2, 'F');
    drawAffectationIcon(pdf, visual.icon, x + 2.5, y + 4.5, visual.color);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.7);
    pdf.setTextColor('#24364b');
    const labelLines = pdf.splitTextToSize(variable.label, cardWidth - 31).slice(0, 3) as string[];
    pdf.text(labelLines, x + 15, y + 6, { lineHeightFactor: 1.05 });
    pdf.setFontSize(16);
    pdf.setTextColor(visual.color);
    pdf.text(String(variableTotals.get(variable.id) || 0), x + cardWidth - 3, y + 12, { align: 'right' });
  });

  const eventsY = panelY + variablesPanelHeight + 5;
  const totalEvents = rows.reduce((sum, row) => sum + row.eventCount, 0);
  pdf.setFillColor('#ffffff');
  pdf.setDrawColor('#cbddeb');
  pdf.roundedRect(panelX, eventsY, 105, 30, 2.5, 2.5, 'FD');
  pdf.setFillColor('#1677d2');
  pdf.roundedRect(panelX + 4, eventsY + 4, 2, 7, 1, 1, 'F');
  pdf.setTextColor('#0f172a');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Eventos', panelX + 9, eventsY + 9);
  pdf.setFillColor('#eaf4ff');
  pdf.roundedRect(panelX + 8, eventsY + 13, 12, 12, 2, 2, 'F');
  drawAffectationIcon(pdf, 'activity', panelX + 9, eventsY + 14, '#1677d2');
  pdf.setFontSize(8);
  pdf.setTextColor('#475569');
  pdf.text('Total eventos', panelX + 24, eventsY + 20);
  pdf.setFontSize(18);
  pdf.setTextColor('#1677d2');
  pdf.text(String(totalEvents), panelX + 98, eventsY + 22, { align: 'right' });

  return eventsY + 46;
}

export async function exportAffectationsToPdf(options: AffectationPdfOptions) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  drawHeader(pdf, options.title, options.filters);
  const detailStartY = drawAffectationSummary(pdf, options.rows, options.variables);
  pdf.setFillColor('#1677d2');
  pdf.roundedRect(PAGE_MARGIN + 4, detailStartY - 7, 2, 7, 1, 1, 'F');
  pdf.setTextColor('#0f172a');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Detalle de afectaciones por provincia', PAGE_MARGIN + 9, detailStartY - 2);

  autoTable(pdf, {
    startY: detailStartY,
    head: [[
      '#',
      'Provincia',
      'Eventos',
      ...options.variables.map((variable) => variable.label),
    ]],
    body: options.rows.map((row, index) => [
      index + 1,
      row.province,
      row.eventCount,
      ...options.variables.map((variable) => row.values[variable.id] || 0),
    ]),
    theme: 'grid',
    styles: {
      fontSize: Math.max(5.5, 8 - options.variables.length * 0.12),
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: '#0b5d8f',
      textColor: '#ffffff',
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 36 },
      2: { cellWidth: 18, halign: 'right' },
    },
    alternateRowStyles: { fillColor: '#f4f8fc' },
    margin: { top: 24, right: PAGE_MARGIN, bottom: 14, left: PAGE_MARGIN },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1, 2],
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawHeader(pdf, options.title, options.filters);
    },
  });

  const generatedAt = new Date().toLocaleString('es-EC');
  const totalPages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor('#64748b');
    pdf.text(`CNE - Generado: ${generatedAt}`, PAGE_MARGIN, pageHeight - 5);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - PAGE_MARGIN, pageHeight - 5, { align: 'right' });
  }

  pdf.save(options.filename);
}
