import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Spin, Switch, Tabs, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MapSelector } from '../../components/map/MapSelector';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type ImportSummary = {
  mensaje?: string;
  infraestructura_tipo_id?: number;
  filas_procesadas: number;
  creados: number;
  actualizados: number;
  sin_cambios: number;
  coordenadas_corregidas?: Array<{
    fila: number;
    dpa: string;
    nombre: string;
    longitud_original: string;
    latitud_original: string;
    longitud_asignada: number;
    latitud_asignada: number;
    mensaje: string;
  }>;
};

type InfraestructuraItem = {
  id: number | string;
  infraestructura_tipo_id?: number;
  dpa?: string;
  nombre?: string;
  direccion?: string;
  provincia_id?: number;
  canton_id?: number;
  parroquia_id?: number;
  zona_id?: number | string;
  latitud?: number | string | null;
  longitud?: number | string | null;
  activo?: boolean;
};

type InfraestructuraTipoItem = {
  id: number;
  nombre?: string;
  siglas?: string;
  descripcion?: string;
};

type DpaItem = {
  id: number | string;
  dpa?: string;
  nombre?: string;
};

type IndividualInfrastructureForm = {
  infraestructura_tipo_id: number;
  provincia_id: number;
  canton_id: number;
  parroquia_id: number;
  zona_id: number;
  codigo_recinto: string;
  nombre: string;
  direccion?: string;
  longitud?: number;
  latitud?: number;
  activo: boolean;
};

type ModalMode = 'individual' | 'csv';
type RecordMode = 'create' | 'view' | 'edit';

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function fileSize(size: number) {
  return `${(size / 1024 / 1024).toLocaleString('es-EC', { maximumFractionDigits: 2 })} MB`;
}

function apiMessage(payload: Record<string, unknown>) {
  const details = payload.detalles;
  if (details && typeof details === 'object') {
    const detailText = Object.entries(details as Record<string, unknown>)
      .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join('. ');
    if (detailText) return detailText;
  }
  return String(payload.detalle || payload.error || payload.mensaje || 'No se pudo procesar el archivo.');
}

function catalogLabel(item: DpaItem) {
  const code = item.dpa || item.id;
  return `${code} - ${item.nombre || 'Sin nombre'}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function ImportarInfraestructuras() {
  const { authFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [individualForm] = Form.useForm<IndividualInfrastructureForm>();
  const [items, setItems] = useState<InfraestructuraItem[]>([]);
  const [infraestructuraTipos, setInfraestructuraTipos] = useState<InfraestructuraTipoItem[]>([]);
  const [infraestructuraTipoFilterId, setInfraestructuraTipoFilterId] = useState<number | undefined>();
  const [gridLoading, setGridLoading] = useState(true);
  const [gridError, setGridError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('individual');
  const [recordMode, setRecordMode] = useState<RecordMode>('create');
  const [selectedItem, setSelectedItem] = useState<InfraestructuraItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [importInfraestructuraTipoId, setImportInfraestructuraTipoId] = useState<number | undefined>();
  const [provincias, setProvincias] = useState<DpaItem[]>([]);
  const [cantones, setCantones] = useState<DpaItem[]>([]);
  const [parroquias, setParroquias] = useState<DpaItem[]>([]);
  const [zonas, setZonas] = useState<DpaItem[]>([]);
  const [dpaLoading, setDpaLoading] = useState(false);
  const [savingIndividual, setSavingIndividual] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadGrid = useCallback(async () => {
    setGridLoading(true);
    setGridError(null);
    try {
      const infraestructurasUrl = infraestructuraTipoFilterId
        ? `${API_BASE_URL}/infraestructuras/infraestructura_tipo/${infraestructuraTipoFilterId}`
        : `${API_BASE_URL}/infraestructuras`;
      const [infraestructurasResponse, tiposResponse] = await Promise.all([
        authFetch(infraestructurasUrl),
        authFetch(`${API_BASE_URL}/infraestructura-tipos`),
      ]);
      if (!infraestructurasResponse.ok || !tiposResponse.ok) throw new Error('No se pudieron cargar infraestructuras');
      const [infraestructurasData, tiposData] = await Promise.all([
        readJson<unknown>(infraestructurasResponse),
        readJson<unknown>(tiposResponse),
      ]);
      setItems(unwrapArray<InfraestructuraItem>(infraestructurasData));
      setInfraestructuraTipos(unwrapArray<InfraestructuraTipoItem>(tiposData));
    } catch {
      setGridError('No se pudo cargar el catalogo de infraestructuras.');
      setItems([]);
      setInfraestructuraTipos([]);
    } finally {
      setGridLoading(false);
    }
  }, [authFetch, infraestructuraTipoFilterId]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => !term || JSON.stringify(item).toLowerCase().includes(term));
  }, [items, search]);

  const tiposById = useMemo(
    () => new Map(infraestructuraTipos.map((tipo) => [tipo.id, tipo])),
    [infraestructuraTipos],
  );
  const selectableInfraestructuraTipos = useMemo(
    () => infraestructuraTipos.filter((tipo) => String(tipo.nombre || '').trim().toLocaleLowerCase('es') !== 'no recinto'),
    [infraestructuraTipos],
  );
  const individualLatitude = Form.useWatch('latitud', individualForm);
  const individualLongitude = Form.useWatch('longitud', individualForm);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [infraestructuraTipoFilterId, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function resetImportState() {
    setModalMode('individual');
    setImportInfraestructuraTipoId(undefined);
    setCantones([]);
    setParroquias([]);
    setZonas([]);
    setFile(null);
    setError(null);
    setSummary(null);
    setDragActive(false);
  }

  async function loadDpaOptions(path: string) {
    const response = await authFetch(`${API_BASE_URL}${path}`);
    if (!response.ok) throw new Error('No se pudo cargar el catálogo DPA.');
    return unwrapArray<DpaItem>(await readJson<unknown>(response));
  }

  async function prepareIndividualForm() {
    setDpaLoading(true);
    try {
      setProvincias(await loadDpaOptions('/provincias'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el catálogo DPA.');
      setProvincias([]);
    } finally {
      setDpaLoading(false);
    }
  }

  async function selectProvincia(provinciaId: number) {
    individualForm.setFieldsValue({ canton_id: undefined, parroquia_id: undefined, zona_id: undefined });
    setCantones([]);
    setParroquias([]);
    setZonas([]);
    setDpaLoading(true);
    setError(null);
    try {
      setCantones(await loadDpaOptions(`/cantones/provincia/${provinciaId}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los cantones.');
    } finally {
      setDpaLoading(false);
    }
  }

  async function selectCanton(cantonId: number) {
    individualForm.setFieldsValue({ parroquia_id: undefined, zona_id: undefined });
    setParroquias([]);
    setZonas([]);
    setDpaLoading(true);
    setError(null);
    try {
      setParroquias(await loadDpaOptions(`/parroquias/canton/${cantonId}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las parroquias.');
    } finally {
      setDpaLoading(false);
    }
  }

  async function selectParroquia(parroquiaId: number) {
    individualForm.setFieldValue('zona_id', undefined);
    setZonas([]);
    setDpaLoading(true);
    setError(null);
    try {
      setZonas(await loadDpaOptions(`/zonas/parroquia/${parroquiaId}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las zonas.');
    } finally {
      setDpaLoading(false);
    }
  }

  function buildIndividualPayload(values: IndividualInfrastructureForm) {
    if (values.latitud === undefined || values.longitud === undefined) {
      setError('Busque una dirección o marque la ubicación en el mapa antes de guardar.');
      return null;
    }
    const selectedZone = zonas.find((item) => Number(item.id) === Number(values.zona_id));
    if (!selectedZone) {
      setError('Seleccione una zona válida del maestro DPA.');
      return null;
    }

    const zoneDpa = String(selectedZone.dpa || selectedZone.id).padStart(11, '0');
    const venueCode = String(values.codigo_recinto).padStart(4, '0');
    const dpa = `${zoneDpa}${venueCode}`;
    return {
      dpa,
      payload: {
      provincia_id: values.provincia_id,
      canton_id: values.canton_id,
      parroquia_id: values.parroquia_id,
      zona_id: values.zona_id,
      dpa,
      infraestructura_tipo_id: values.infraestructura_tipo_id,
      nombre: values.nombre.trim(),
      direccion: values.direccion?.trim() || null,
      longitud: values.longitud ?? 0,
      latitud: values.latitud ?? 0,
      activo: values.activo,
      },
    };
  }

  async function saveIndividual(values: IndividualInfrastructureForm) {
    if (savingIndividual) return;
    const built = buildIndividualPayload(values);
    if (!built) return;
    const { dpa, payload } = built;

    setSavingIndividual(true);
    setError(null);
    try {
      const response = await authFetch(`${API_BASE_URL}/infraestructuras`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const responsePayload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (!response.ok) {
        setError(apiMessage(responsePayload));
        return;
      }
      message.success(`Infraestructura ${dpa} creada correctamente.`);
      setModalOpen(false);
      await loadGrid();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo conectar con el servidor. Intente nuevamente.');
    } finally {
      setSavingIndividual(false);
    }
  }

  async function updateIndividual(values: IndividualInfrastructureForm) {
    if (!selectedItem || savingIndividual) return;
    const built = buildIndividualPayload(values);
    if (!built) return;
    const { dpa, payload } = built;

    setSavingIndividual(true);
    setError(null);
    try {
      const response = await authFetch(`${API_BASE_URL}/infraestructuras/${selectedItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const responsePayload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (!response.ok) {
        setError(apiMessage(responsePayload));
        return;
      }
      message.success(`Infraestructura ${dpa} actualizada correctamente.`);
      setModalOpen(false);
      await loadGrid();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo conectar con el servidor. Intente nuevamente.');
    } finally {
      setSavingIndividual(false);
    }
  }

  async function openExistingItem(item: InfraestructuraItem, mode: Exclude<RecordMode, 'create'>) {
    setRecordMode(mode);
    setSelectedItem(item);
    setModalMode('individual');
    setError(null);
    setSummary(null);
    setModalOpen(true);
    setDpaLoading(true);
    try {
      const [provinceOptions, cantonOptions, parishOptions, zoneOptions] = await Promise.all([
        loadDpaOptions('/provincias'),
        item.provincia_id ? loadDpaOptions(`/cantones/provincia/${item.provincia_id}`) : Promise.resolve([]),
        item.canton_id ? loadDpaOptions(`/parroquias/canton/${item.canton_id}`) : Promise.resolve([]),
        item.parroquia_id ? loadDpaOptions(`/zonas/parroquia/${item.parroquia_id}`) : Promise.resolve([]),
      ]);
      setProvincias(provinceOptions);
      setCantones(cantonOptions);
      setParroquias(parishOptions);
      setZonas(zoneOptions);
      individualForm.setFieldsValue({
        infraestructura_tipo_id: item.infraestructura_tipo_id,
        provincia_id: item.provincia_id,
        canton_id: item.canton_id,
        parroquia_id: item.parroquia_id,
        zona_id: item.zona_id !== undefined ? Number(item.zona_id) : undefined,
        codigo_recinto: String(item.dpa || item.id).padStart(15, '0').slice(-4),
        nombre: item.nombre || '',
        direccion: item.direccion || '',
        longitud: item.longitud !== null && item.longitud !== undefined ? Number(item.longitud) : undefined,
        latitud: item.latitud !== null && item.latitud !== undefined ? Number(item.latitud) : undefined,
        activo: item.activo !== false,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el detalle de la infraestructura.');
    } finally {
      setDpaLoading(false);
    }
  }

  async function deleteInfrastructure(item: InfraestructuraItem) {
    setDeletingId(item.id);
    try {
      const response = await authFetch(`${API_BASE_URL}/infraestructuras/${item.id}`, { method: 'DELETE' });
      if (response.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (!response.ok) {
        const responsePayload = await response.json().catch(() => ({})) as Record<string, unknown>;
        message.error(apiMessage(responsePayload));
        return;
      }
      message.success('Infraestructura eliminada correctamente.');
      await loadGrid();
    } catch (requestError) {
      message.error(requestError instanceof Error ? requestError.message : 'No se pudo eliminar la infraestructura.');
    } finally {
      setDeletingId(null);
    }
  }

  function selectFile(nextFile: File | null, totalFiles = 1) {
    setError(null);
    setSummary(null);
    if (!nextFile) {
      setFile(null);
      setError('Seleccione un archivo CSV para continuar.');
      return;
    }
    if (totalFiles !== 1) {
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
    if (!file || !importInfraestructuraTipoId || processing) return;

    setProcessing(true);
    setError(null);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append('infraestructura_tipo_id', String(importInfraestructuraTipoId));
      formData.append('archivo', file);

      const response = await authFetch(`${API_BASE_URL}/infraestructuras/importar`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;

      if (response.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (response.status === 400 || response.status === 409) {
        setError(apiMessage(payload));
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
    <div className="coe-page infraestructuras-import-page">
     
      <Card className="functional-card maestro-dpa-card">
        <div className="base-crud__header">
          <div>
            <span className="eyebrow">Catalogo</span>
            <div>
              <h2 style={{ margin: 0 }}>Infraestructuras</h2>
              <span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 14 }}>
                Consulte los registros cargados. Use Nuevo para agregar una infraestructura o importar un CSV.
              </span>
            </div>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadGrid()} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              resetImportState();
              setRecordMode('create');
              setSelectedItem(null);
              setModalOpen(true);
              void prepareIndividualForm();
            }}>
              Nuevo
            </Button>
          </Space>
        </div>

        {gridError ? <Alert className="mb-3" type="warning" showIcon message={gridError} /> : null}

        <div className="base-crud__toolbar infraestructuras-import-page__toolbar" style={{ marginTop: 14 }}>
          <Select
            aria-label="Filtrar por tipo de recinto"
            optionFilterProp="label"
            options={infraestructuraTipos.map((tipo) => ({
              value: tipo.id,
              label: tipo.nombre || tipo.siglas || `Tipo ${tipo.id}`,
            }))}
            placeholder="Todos los tipos de infraestructura"
            allowClear
            showSearch
            style={{ width: 320 }}
            value={infraestructuraTipoFilterId}
            onChange={(value) => setInfraestructuraTipoFilterId(value)}
          />
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <Spin spinning={gridLoading}>
          <div className="base-crud__table-wrap">
            <table className="table table-hover align-middle base-crud__table">
              <thead>
                <tr>
                  <th>DPA</th>
                  <th>Tipo de infraestructura</th>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Provincia</th>
                  <th>Cantón</th>
                  <th>Parroquia</th>
                  <th>Zona</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length ? visibleItems.map((item) => (
                  <tr key={String(item.id)}>
                    <td>{item.dpa || ''}</td>
                    <td>{item.infraestructura_tipo_id ? (tiposById.get(item.infraestructura_tipo_id)?.nombre || tiposById.get(item.infraestructura_tipo_id)?.siglas || `Tipo ${item.infraestructura_tipo_id}`) : ''}</td>
                    <td>{item.nombre || ''}</td>
                    <td>{item.direccion || ''}</td>
                    <td>{item.provincia_id || ''}</td>
                    <td>{item.canton_id || ''}</td>
                    <td>{item.parroquia_id || ''}</td>
                    <td>{item.zona_id || ''}</td>
                    <td>{item.activo === false ? 'No' : 'Sí'}</td>
                    <td>
                      <div className="row-actions">
                        <Tooltip title="Ver">
                          <Button aria-label={`Ver ${item.nombre || item.id}`} icon={<EyeOutlined />} onClick={() => void openExistingItem(item, 'view')} />
                        </Tooltip>
                        <Tooltip title={Number(item.id) === 0 ? 'El registro NO RECINTO está protegido' : 'Editar'}>
                          <Button aria-label={`Editar ${item.nombre || item.id}`} icon={<EditOutlined />} disabled={Number(item.id) === 0} onClick={() => void openExistingItem(item, 'edit')} />
                        </Tooltip>
                        <Popconfirm
                          title="Eliminar infraestructura"
                          description={`¿Está seguro de eliminar ${item.nombre || item.dpa || item.id}?`}
                          okText="Eliminar"
                          cancelText="Cancelar"
                          okButtonProps={{ danger: true, loading: deletingId === item.id }}
                          disabled={Number(item.id) === 0}
                          onConfirm={() => deleteInfrastructure(item)}
                        >
                          <Tooltip title={Number(item.id) === 0 ? 'El registro NO RECINTO está protegido' : 'Eliminar'}>
                            <Button className="row-actions__delete" danger aria-label={`Eliminar ${item.nombre || item.id}`} icon={<DeleteOutlined />} disabled={Number(item.id) === 0} loading={deletingId === item.id} />
                          </Tooltip>
                        </Popconfirm>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={10} className="text-center text-muted py-4">No hay registros disponibles.</td></tr>
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
        width={1000}
        open={modalOpen}
        title={recordMode === 'view' ? 'Detalle de infraestructura' : recordMode === 'edit' ? 'Editar infraestructura' : 'Nueva infraestructura'}
        onCancel={() => setModalOpen(false)}
        afterOpenChange={(open) => {
          if (open && recordMode === 'create') {
            individualForm.resetFields();
            individualForm.setFieldValue('activo', true);
          }
        }}
        footer={null}
      >
        <Tabs
          activeKey={modalMode}
          tabBarStyle={recordMode === 'create' ? undefined : { display: 'none' }}
          onChange={(key) => {
            setModalMode(key as ModalMode);
            setError(null);
            setSummary(null);
            if (key === 'individual' && !provincias.length) void prepareIndividualForm();
          }}
          items={[
            {
              key: 'individual',
              label: 'Registro individual',
              children: (
                <Spin spinning={dpaLoading}>
                  <Typography.Paragraph type="secondary">
                    {recordMode === 'view'
                      ? 'Consulte los datos y la ubicación registrada de la infraestructura.'
                      : 'Seleccione la provincia, cantón, parroquia y zona existentes en el maestro DPA. El código DPA de la infraestructura se construirá con esos datos.'}
                  </Typography.Paragraph>
                  <Form
                    className="infraestructuras-individual-form"
                    form={individualForm}
                    layout="vertical"
                    initialValues={{ activo: true }}
                    onFinish={(values) => void (recordMode === 'edit' ? updateIndividual(values) : saveIndividual(values))}
                  >
                    <div className="infraestructuras-form-grid">
                      <Form.Item label="Tipo de infraestructura" name="infraestructura_tipo_id" rules={[{ required: true, message: 'Seleccione el tipo de infraestructura.' }]}>
                        <Select
                          showSearch
                          optionFilterProp="label"
                          disabled={recordMode === 'view'}
                          placeholder="Seleccione un tipo"
                          options={(recordMode === 'view' ? infraestructuraTipos : selectableInfraestructuraTipos).map((tipo) => ({ value: tipo.id, label: tipo.nombre || tipo.siglas || `Tipo ${tipo.id}` }))}
                        />
                      </Form.Item>
                      <Form.Item label="Activo" name="activo" valuePropName="checked">
                        <Switch disabled={recordMode === 'view'} checkedChildren="Sí" unCheckedChildren="No" />
                      </Form.Item>
                    </div>

                    <div className="infraestructuras-form-grid infraestructuras-form-grid--dpa">
                      <Form.Item label="Provincia" name="provincia_id" rules={[{ required: true, message: 'Seleccione una provincia del DPA.' }]}>
                        <Select showSearch optionFilterProp="label" disabled={recordMode === 'view'} placeholder="Seleccione una provincia" options={provincias.map((item) => ({ value: Number(item.id), label: catalogLabel(item) }))} onChange={(value) => void selectProvincia(value)} />
                      </Form.Item>
                      <Form.Item label="Cantón" name="canton_id" rules={[{ required: true, message: 'Seleccione un cantón del DPA.' }]}>
                        <Select showSearch optionFilterProp="label" disabled={recordMode === 'view' || !cantones.length} placeholder="Seleccione un cantón" options={cantones.map((item) => ({ value: Number(item.id), label: catalogLabel(item) }))} onChange={(value) => void selectCanton(value)} />
                      </Form.Item>
                      <Form.Item label="Parroquia" name="parroquia_id" rules={[{ required: true, message: 'Seleccione una parroquia del DPA.' }]}>
                        <Select showSearch optionFilterProp="label" disabled={recordMode === 'view' || !parroquias.length} placeholder="Seleccione una parroquia" options={parroquias.map((item) => ({ value: Number(item.id), label: catalogLabel(item) }))} onChange={(value) => void selectParroquia(value)} />
                      </Form.Item>
                      <Form.Item label="Zona" name="zona_id" rules={[{ required: true, message: 'Seleccione una zona del DPA.' }]}>
                        <Select showSearch optionFilterProp="label" disabled={recordMode === 'view' || !zonas.length} placeholder="Seleccione una zona" options={zonas.map((item) => ({ value: Number(item.id), label: catalogLabel(item) }))} />
                      </Form.Item>
                    </div>

                    <div className="infraestructuras-form-grid infraestructuras-form-grid--identity">
                      <Form.Item label="Código de infraestructura" name="codigo_recinto" extra="De 1 a 4 dígitos; se completará con ceros a la izquierda." rules={[{ required: true, message: 'Ingrese el código.' }, { pattern: /^\d{1,4}$/, message: 'Use únicamente de 1 a 4 dígitos.' }]}>
                        <Input disabled={recordMode === 'view'} maxLength={4} inputMode="numeric" placeholder="Ej. 978" />
                      </Form.Item>
                      <Form.Item label="Nombre" name="nombre" rules={[{ required: true, whitespace: true, message: 'Ingrese el nombre.' }]}>
                        <Input disabled={recordMode === 'view'} maxLength={250} placeholder="Nombre de la infraestructura" />
                      </Form.Item>
                    </div>

                    <Form.Item label="Dirección" name="direccion">
                      <Input disabled={recordMode === 'view'} maxLength={500} placeholder="Dirección o referencia" />
                    </Form.Item>

                    <Form.Item label="Buscar y ubicar en el mapa" required className="infraestructuras-form__location">
                      <MapSelector
                        readonly={recordMode === 'view'}
                        latitude={individualLatitude}
                        longitude={individualLongitude}
                        onChange={({ latitude, longitude }) => individualForm.setFieldsValue({ latitud: latitude, longitud: longitude })}
                        onAddressChange={(address) => individualForm.setFieldValue('direccion', address)}
                      />
                    </Form.Item>

                    <Form.Item name="longitud" hidden><Input type="hidden" /></Form.Item>
                    <Form.Item name="latitud" hidden><Input type="hidden" /></Form.Item>

                    {error ? <Alert className="dpa-alert" type="error" showIcon title="No se pudo guardar la infraestructura" description={error} /> : null}
                    <Space className="dpa-actions">
                      {recordMode === 'view' ? null : <Button type="primary" htmlType="submit" size="large" loading={savingIndividual}>{recordMode === 'edit' ? 'Guardar cambios' : 'Guardar infraestructura'}</Button>}
                      <Button size="large" onClick={() => setModalOpen(false)}>{recordMode === 'view' ? 'Cerrar' : 'Cancelar'}</Button>
                    </Space>
                  </Form>
                </Spin>
              ),
            },
            ...(recordMode === 'create' ? [{
              key: 'csv',
              label: 'Importar CSV',
              children: (
                <>
                  <Typography.Paragraph type="secondary">
                    El archivo se validará antes de crear o actualizar las infraestructuras. Solo se admite un archivo CSV de hasta 5 MB.
                  </Typography.Paragraph>
                  <div className="infraestructuras-import-type">
                    <label htmlFor="infraestructuras-tipo">Tipo de infraestructura</label>
                    <Select
                      id="infraestructuras-tipo"
                      aria-label="Tipo para importar infraestructuras"
                      optionFilterProp="label"
                      options={selectableInfraestructuraTipos.map((tipo) => ({ value: tipo.id, label: `ID ${tipo.id} - ${tipo.nombre || tipo.siglas || `Tipo ${tipo.id}`}` }))}
                      placeholder="Seleccione el tipo de infraestructura"
                      showSearch
                      value={importInfraestructuraTipoId}
                      onChange={setImportInfraestructuraTipoId}
                    />
                  </div>
                  <label className={`dpa-upload ${dragActive ? 'dpa-upload--active' : ''}`} htmlFor="infraestructuras-file" onDragEnter={() => setDragActive(true)} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>
                    <InboxOutlined />
                    <span>
                      <strong>{file ? file.name : 'Arrastre un archivo CSV aquí o selecciónelo'}</strong>
                      <small>{file ? `Tamaño: ${fileSize(file.size)}` : 'Se permite un único archivo .csv de máximo 5 MB.'}</small>
                    </span>
                    <input id="infraestructuras-file" type="file" accept=".csv,text/csv" onClick={(event) => { event.currentTarget.value = ''; }} onChange={handleInputChange} />
                  </label>
                  {file ? <div className="dpa-file-details" aria-live="polite"><strong>Archivo seleccionado:</strong> {file.name} <span>{fileSize(file.size)}</span></div> : null}
                  {error ? <Alert className="dpa-alert" type="error" showIcon title="No se pudo procesar el archivo" description={error} /> : null}
                  <Space className="dpa-actions">
                    <Button type="primary" size="large" loading={processing} disabled={!file || !importInfraestructuraTipoId || processing} onClick={() => void processFile()}>Procesar archivo</Button>
                    {processing ? <span className="dpa-processing"><Spin size="small" /> Procesando el archivo...</span> : null}
                  </Space>
                  {summary ? <Alert className="dpa-alert" type={summary.coordenadas_corregidas?.length ? 'warning' : 'success'} showIcon title={summary.mensaje || 'Importación de infraestructuras completada'} description={
                    <div>
                      <Descriptions className="dpa-result" size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                        <Descriptions.Item label="Tipo infraestructura ID">{summary.infraestructura_tipo_id}</Descriptions.Item>
                        <Descriptions.Item label="Filas procesadas">{summary.filas_procesadas}</Descriptions.Item>
                        <Descriptions.Item label="Creados">{summary.creados}</Descriptions.Item>
                        <Descriptions.Item label="Actualizados">{summary.actualizados}</Descriptions.Item>
                        <Descriptions.Item label="Sin cambios">{summary.sin_cambios}</Descriptions.Item>
                      </Descriptions>
                      {summary.coordenadas_corregidas?.length ? <div className="dpa-coordinate-warnings"><Typography.Text type="warning" strong>Coordenada incorrecta, corregir y volver a cargar el archivo. {summary.coordenadas_corregidas.length} registro(s) se guardaron temporalmente con longitud 0.0 y latitud 0.0:</Typography.Text><ul>{summary.coordenadas_corregidas.slice(0, 20).map((issue, index) => <li key={`${issue.fila}-${issue.dpa}-${index}`}>Fila {issue.fila}, DPA {issue.dpa}, {issue.nombre}: longitud &quot;{issue.longitud_original}&quot;, latitud &quot;{issue.latitud_original}&quot; → 0.0, 0.0</li>)}</ul>{summary.coordenadas_corregidas.length > 20 ? <small>Se muestran las primeras 20 correcciones.</small> : null}</div> : null}
                    </div>
                  } /> : null}
                </>
              ),
            }] : []),
          ]}
        />
      </Modal>
    </div>
  );
}
