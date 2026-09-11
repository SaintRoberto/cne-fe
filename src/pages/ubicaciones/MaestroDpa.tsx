import { useState, type ChangeEvent, type DragEvent } from 'react';
import { Alert, Button, Card, Descriptions, Space, Spin, Typography, message } from 'antd';
import { CheckCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { MapPinned } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type ImportMode = 'reemplazo';
type Counters = { eliminados: number; creados: number; actualizados: number };

type ImportSummary = {
  mensaje?: string;
  modo?: ImportMode;
  filas_procesadas: number;
  provincias: Counters;
  cantones: Counters;
  parroquias: Counters;
  zonas: Counters;
};

function fileSize(size: number) {
  return `${(size / 1024 / 1024).toLocaleString('es-EC', { maximumFractionDigits: 2 })} MB`;
}

function modeLabel(mode: ImportMode) {
  return mode === 'reemplazo' ? 'Reemplazo completo' : mode;
}

function counterText(counter: Counters) {
  return `${counter.eliminados} eliminados · ${counter.creados} creados`;
}

function apiMessage(payload: Record<string, unknown>) {
  return String(payload.detalle || payload.error || payload.mensaje || 'No se pudo procesar el archivo.');
}

export function MaestroDpa() {
  const { authFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [executedMode, setExecutedMode] = useState<ImportMode | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  function selectFile(nextFile: File | null, totalFiles = 1) {
    setError(null);
    setSummary(null);
    setExecutedMode(null);
    if (!nextFile) {
      setFile(null);
      setError('Seleccione un archivo CSV para continuar.');
      return;
    }
    if (totalFiles > 1) {
      setFile(null);
      setError('Seleccione únicamente un archivo CSV.');
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null);
      setError('El archivo debe tener extensión .csv.');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setError('El archivo no puede superar los 5 MB.');
      return;
    }
    setFile(nextFile);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    selectFile(files?.[0] || null, files?.length || 0);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files[0] || null, event.dataTransfer.files.length);
  }

  async function processFile() {
    if (!file || processing) return;
    setProcessing(true);
    setError(null);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);

      const response = await authFetch(`${API_BASE_URL}/ubicaciones/importar`, { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (response.status === 409) {
        setError(`${apiMessage(payload)} El catálogo anterior permanece sin cambios.`);
        return;
      }
      if (response.status >= 500) {
        setError('Ocurrió un error interno al procesar el archivo. Intente nuevamente.');
        return;
      }
      if (!response.ok) {
        setError(apiMessage(payload));
        return;
      }

      setExecutedMode((payload.modo as ImportMode | undefined) || 'reemplazo');
      setSummary(payload as unknown as ImportSummary);
      message.success('Archivo procesado correctamente.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo conectar con el servidor. Intente nuevamente.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="coe-page maestro-dpa-page">
      <section className="module-strip">
        <div>
          <span>Administración territorial</span>
          <h2>Importación del maestro DPA</h2>
          <p>Las provincias, cantones, parroquias y zonas se gestionan exclusivamente desde el archivo CSV.</p>
        </div>
        <MapPinned size={42} />
      </section>

      <Card className="functional-card maestro-dpa-card">
        <Typography.Title level={4}>Seleccionar archivo</Typography.Title>
        <Typography.Paragraph type="secondary">
          Cada importación valida primero el CSV y después reemplaza completamente provincias, cantones, parroquias y zonas, reiniciando sus identificadores.
        </Typography.Paragraph>

        <label
          className={`dpa-upload ${dragActive ? 'dpa-upload--active' : ''}`}
          htmlFor="dpa-file"
          onDragEnter={() => setDragActive(true)}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <InboxOutlined />
          <span>
            <strong>{file ? file.name : 'Arrastre un archivo CSV aquí o selecciónelo'}</strong>
            <small>{file ? `Tamaño: ${fileSize(file.size)}` : 'Se permite un único archivo .csv de máximo 5 MB.'}</small>
          </span>
          <input id="dpa-file" type="file" accept=".csv,text/csv" onClick={(event) => { event.currentTarget.value = ''; }} onChange={handleInputChange} />
        </label>

        {file ? <div className="dpa-file-details" aria-live="polite"><strong>Archivo seleccionado:</strong> {file.name} <span>{fileSize(file.size)}</span></div> : null}
        {error ? <Alert className="dpa-alert" type="error" showIcon title="No se pudo procesar el archivo" description={error} /> : null}

        <Space className="dpa-actions">
          <Button type="primary" size="large" loading={processing} disabled={!file || processing} onClick={() => void processFile()}>
            Importar y reemplazar catálogo
          </Button>
          {processing ? <span className="dpa-processing"><Spin size="small" /> Verificando y procesando el archivo…</span> : null}
        </Space>

        {summary && executedMode ? <Alert className="dpa-alert" type="success" showIcon icon={<CheckCircleOutlined />} title={summary.mensaje || 'Importación DPA completada'} description={
          <Descriptions className="dpa-result" size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Modo ejecutado">{modeLabel(executedMode)}</Descriptions.Item>
            <Descriptions.Item label="Filas procesadas">{summary.filas_procesadas}</Descriptions.Item>
            <Descriptions.Item label="Provincias">{counterText(summary.provincias)}</Descriptions.Item>
            <Descriptions.Item label="Cantones">{counterText(summary.cantones)}</Descriptions.Item>
            <Descriptions.Item label="Parroquias">{counterText(summary.parroquias)}</Descriptions.Item>
            <Descriptions.Item label="Zonas">{counterText(summary.zonas)}</Descriptions.Item>
          </Descriptions>
        } /> : null}
      </Card>
    </div>
  );
}
