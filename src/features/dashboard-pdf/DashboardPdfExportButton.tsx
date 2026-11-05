import { useState } from 'react';
import { Button, message } from 'antd';
import { FileDown } from 'lucide-react';
import { exportDashboardToPdf, type DashboardPdfEvent, type DashboardPdfFilter } from './exportDashboardToPdf';
import './dashboardPdf.css';

type DashboardPdfExportButtonProps = {
  events: DashboardPdfEvent[];
  filename: string;
  filters: DashboardPdfFilter[];
  title: string;
};

export function DashboardPdfExportButton({ events, filename, filters, title }: DashboardPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!events.length) {
      message.warning('No existen eventos para incluir en el reporte.');
      return;
    }

    setExporting(true);
    try {
      await exportDashboardToPdf({ events, filename, filters, title });
      message.success('PDF generado correctamente.');
    } catch (error) {
      console.error('No se pudo exportar el dashboard a PDF', error);
      message.error('No se pudo generar el PDF del dashboard.');
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
      onClick={() => void handleExport()}
    >
      PDF
    </Button>
  );
}
