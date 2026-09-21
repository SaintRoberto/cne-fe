import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { Alert, Button, Card, Descriptions, Input, Modal, Space, Spin, Tabs, Typography, message } from 'antd';
import { CheckCircleOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
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

type DpaLevel = 'provincias' | 'cantones' | 'parroquias' | 'zonas';

type DpaItem = {
  id: number | string;
  dpa?: string;
  nombre?: string;
  provincia_id?: number;
  canton_id?: number;
  parroquia_id?: number;
  activo?: boolean;
};

const levelLabels: Record<DpaLevel, string> = {
  provincias: 'Provincias',
  cantones: 'Cantones',
  parroquias: 'Parroquias',
  zonas: 'Zonas',
};

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function fileSize(size: number) {
  return `${(size / 1024 / 1024).toLocaleString('es-EC', { maximumFractionDigits: 2 })} MB`;
}

function modeLabel(mode: ImportMode) {
  return mode === 'reemplazo' ? 'Reemplazo completo' : mode;
}

function counterText(counter: Counters) {
  return `${counter.eliminados} eliminados - ${counter.creados} creados`;
}

function apiMessage(payload: Record<string, unknown>) {
  return String(payload.detalle || payload.error || payload.mensaje || 'No se pudo procesar el archivo.');
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function MaestroDpa() {
  const { authFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Record<DpaLevel, DpaItem[]>>({
    provincias: [],
    cantones: [],
    parroquias: [],
    zonas: [],
  });
  const [gridLoading, setGridLoading] = useState(true);
  const [gridError, setGridError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeLevel, setActiveLevel] = useState<DpaLevel>('provincias');
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [executedMode, setExecutedMode] = useState<ImportMode | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadGrid = useCallback(async () => {
    setGridLoading(true);
    setGridError(null);
    try {
      const [provincias, cantones, parroquias, zonas] = await Promise.all(
        (['provincias', 'cantones', 'parroquias', 'zonas'] as DpaLevel[]).map(async (level) => {
          const response = await authFetch(`${API_BASE_URL}/${level}`);
          if (!response.ok) throw new Error(levelLabels[level]);
          return unwrapArray<DpaItem>(await readJson<unknown>(response));
        }),
      );
      setItems({ provincias, cantones, parroquias, zonas });
    } catch {
      setGridError('No se pudo cargar el catalogo DPA.');
      setItems({ provincias: [], cantones: [], parroquias: [], zonas: [] });
    } finally {
      setGridLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = items[activeLevel] || [];
    if (!term) return source;
    return source.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [activeLevel, items, search]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeLevel, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function resetImportState() {
    setFile(null);
    setError(null);
    setSummary(null);
    setExecutedMode(null);
    setDragActive(false);
  }

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
      setError('Seleccione unicamente un archivo CSV.');
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null);
      setError('El archivo debe tener extension .csv.');
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
        setError(`${apiMessage(payload)} El catalogo anterior permanece sin cambios.`);
        return;
      }
      if (response.status >= 500) {
        setError('Ocurrio un error interno al procesar el archivo. Intente nuevamente.');
        return;
      }
      if (!response.ok) {
        setError(apiMessage(payload));
        return;
      }

      setExecutedMode((payload.modo as ImportMode | undefined) || 'reemplazo');
      setSummary(payload as unknown as ImportSummary);
      message.success('Archivo procesado correctamente.');
      await loadGrid();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo conectar con el servidor. Intente nuevamente.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="coe-page maestro-dpa-page">
      <Card className="functional-card maestro-dpa-card">
        <div className="base-crud__header">
          <div>
            <span className="eyebrow">Catalogo territorial</span>
            <div className="dpa-title-row">
              <h2 style={{ margin: 0 }}>DPA</h2>             
               <span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 14 }}>
                 Consulte provincias, cantones, parroquias y zonas. Use Nuevo para importar el CSV maestro.
              </span>
            </div>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadGrid()} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              resetImportState();
              setModalOpen(true);
            }}>
              Nuevo
            </Button>
          </Space>
        </div>

        {gridError ? <Alert className="mb-3" type="warning" showIcon message={gridError} /> : null}

        <div className="base-crud__toolbar">
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <Tabs
          className="catalog-tabs"
          activeKey={activeLevel}
          onChange={(key) => setActiveLevel(key as DpaLevel)}
          items={(Object.keys(levelLabels) as DpaLevel[]).map((level) => ({
            key: level,
            label: `${levelLabels[level]} (${items[level].length})`,
          }))}
        />

        <Spin spinning={gridLoading}>
          <div className="base-crud__table-wrap">
            <table className="table table-hover align-middle base-crud__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>DPA</th>
                  <th>Nombre</th>
                  {activeLevel !== 'provincias' ? <th>Provincia</th> : null}
                  {activeLevel === 'parroquias' || activeLevel === 'zonas' ? <th>Cantón</th> : null}
                  {activeLevel === 'zonas' ? <th>Parroquia</th> : null}
                  <th>Activo</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length ? visibleItems.map((item) => (
                  <tr key={String(item.id)}>
                    <td>{item.id}</td>
                    <td>{item.dpa || ''}</td>
                    <td>{item.nombre || ''}</td>
                    {activeLevel !== 'provincias' ? <td>{item.provincia_id || ''}</td> : null}
                    {activeLevel === 'parroquias' || activeLevel === 'zonas' ? <td>{item.canton_id || ''}</td> : null}
                    {activeLevel === 'zonas' ? <td>{item.parroquia_id || ''}</td> : null}
                    <td>{item.activo === false ? 'No' : 'Sí'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={activeLevel === 'zonas' ? 7 : activeLevel === 'parroquias' ? 6 : activeLevel === 'cantones' ? 5 : 4} className="text-center text-muted py-4">No hay registros disponibles.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="base-crud__pagination">
            <span>{filteredItems.length} registros</span>
            <Space>
              <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
              <span>{page} / {totalPages}</span>
              <Button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</Button>
            </Space>
          </div>
        </Spin>
      </Card>

      <Modal
        centered
        destroyOnHidden
        width={720}
        open={modalOpen}
        title="Importar maestro DPA"
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Typography.Paragraph type="secondary">
          Cada importacion valida primero el CSV y despues reemplaza completamente provincias, cantones, parroquias y zonas.
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
            <strong>{file ? file.name : 'Arrastre un archivo CSV aqui o seleccionelo'}</strong>
            <small>{file ? `Tamano: ${fileSize(file.size)}` : 'Se permite un unico archivo .csv de maximo 5 MB.'}</small>
          </span>
          <input id="dpa-file" type="file" accept=".csv,text/csv" onClick={(event) => { event.currentTarget.value = ''; }} onChange={handleInputChange} />
        </label>

        {file ? <div className="dpa-file-details" aria-live="polite"><strong>Archivo seleccionado:</strong> {file.name} <span>{fileSize(file.size)}</span></div> : null}
        {error ? <Alert className="dpa-alert" type="error" showIcon title="No se pudo procesar el archivo" description={error} /> : null}

        <Space className="dpa-actions">
          <Button type="primary" size="large" loading={processing} disabled={!file || processing} onClick={() => void processFile()}>
            Importar y reemplazar catalogo
          </Button>
          {processing ? <span className="dpa-processing"><Spin size="small" /> Verificando y procesando el archivo...</span> : null}
        </Space>

        {summary && executedMode ? <Alert className="dpa-alert" type="success" showIcon icon={<CheckCircleOutlined />} title={summary.mensaje || 'Importacion DPA completada'} description={
          <Descriptions className="dpa-result" size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Modo ejecutado">{modeLabel(executedMode)}</Descriptions.Item>
            <Descriptions.Item label="Filas procesadas">{summary.filas_procesadas}</Descriptions.Item>
            <Descriptions.Item label="Provincias">{counterText(summary.provincias)}</Descriptions.Item>
            <Descriptions.Item label="Cantones">{counterText(summary.cantones)}</Descriptions.Item>
            <Descriptions.Item label="Parroquias">{counterText(summary.parroquias)}</Descriptions.Item>
            <Descriptions.Item label="Zonas">{counterText(summary.zonas)}</Descriptions.Item>
          </Descriptions>
        } /> : null}
      </Modal>
    </div>
  );
}
