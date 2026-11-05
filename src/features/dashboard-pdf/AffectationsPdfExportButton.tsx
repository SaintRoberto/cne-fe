import { useState } from 'react';
import { Button, message } from 'antd';
import { FileDown } from 'lucide-react';
import type { DashboardPdfFilter } from './exportDashboardToPdf';
import {
  exportAffectationsToPdf,
  type AffectationPdfRow,
  type AffectationPdfVariable,
} from './exportAffectationsToPdf';
import './dashboardPdf.css';

type AffectationsPdfExportButtonProps = {
  filename: string;
  filters: DashboardPdfFilter[];
  rows: AffectationPdfRow[];
  title: string;
  variables: AffectationPdfVariable[];
};

export function AffectationsPdfExportButton({
  filename,
  filters,
  rows,
  title,
  variables,
}: AffectationsPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!rows.length) {
      message.warning('No existen afectaciones para incluir en el reporte.');
      return;
    }

    setExporting(true);
    try {
      await exportAffectationsToPdf({ filename, filters, rows, title, variables });
      message.success('PDF de afectaciones generado correctamente.');
    } catch (error) {
      console.error('No se pudo exportar el resumen de afectaciones a PDF', error);
      message.error('No se pudo generar el PDF de afectaciones.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      className="dashboard-pdf-export-button"
      type="primary"
      icon={<FileDown size={18} strokeWidth={2.4} />}
      loading={exporting}
      disabled={!rows.length}
      onClick={() => void handleExport()}
    >
      PDF
    </Button>
  );
}
