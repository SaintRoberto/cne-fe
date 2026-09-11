import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, Input, Row, Select, Spin, message } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { BaseCRUD, type CrudColumn } from '../../components/crud/BaseCRUD';
import { MapSelector } from '../../components/map/MapSelector';

type CatalogItem = {
  id: number;
  nombre?: string;
  descripcion?: string;
  provincia_id?: number;
  canton_id?: number;
  parroquia_id?: number;
  tipo_id?: number;
};

type EventoItem = {
  id?: number | string;
  evento_id?: number;
  fecha_evento?: string;
  sector?: string;
  situacion?: string;
  observacion?: string;
  latitud?: number | null;
  longitud?: number | null;
  provincia_id?: number | null;
  canton_id?: number | null;
  parroquia_id?: number | null;
  tipo_id?: number | null;
  subtipo_id?: number | null;
  causa_id?: number | null;
  estado_id?: number | null;
  origen_id?: number | null;
  atencion_estado_id?: number | null;
  emergencia_id?: number | null;
  provincia?: string;
  canton?: string;
  parroquia?: string;
  tipo?: string;
  subtipo?: string;
  causa?: string;
  estado?: string;
  origen?: string;
  atencion_estado?: string;
  descripcion?: string;
  evento_fecha?: string;
  evento_tipo_id?: number | null;
  evento_subtipo_id?: number | null;
  evento_causa_id?: number | null;
  evento_origen_id?: number | null;
  evento_atencion_estado_id?: number | null;
  evento_causa_nombre?: string;
  evento_origen_nombre?: string;
  evento_tipo_nombre?: string;
  evento_subtipo_nombre?: string;
  provincia_nombre?: string;
  canton_nombre?: string;
  parroquia_nombre?: string;
  creacion?: string;
  [key: string]: unknown;
};

const emptyEvento: EventoItem = {
  fecha_evento: dayjs().format('YYYY-MM-DD'),
  sector: '',
  situacion: '',
  observacion: '',
  latitud: -1.05458,
  longitud: -80.45445,
  provincia_id: null,
  canton_id: null,
  parroquia_id: null,
  tipo_id: null,
  subtipo_id: null,
  causa_id: null,
  estado_id: null,
  origen_id: null,
  atencion_estado_id: null,
};

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result;
  return Array.isArray(candidate) ? candidate as T[] : [];
}

function nameOf(item: CatalogItem) {
  return item.nombre || item.descripcion || String(item.id);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function EventosAdversos() {
  const { authFetch, datosLogin, selectedEmergenciaId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [causas, setCausas] = useState<CatalogItem[]>([]);
  const [estados, setEstados] = useState<CatalogItem[]>([]);
  const [origenes, setOrigenes] = useState<CatalogItem[]>([]);
  const [tipos, setTipos] = useState<CatalogItem[]>([]);
  const [subtipos, setSubtipos] = useState<CatalogItem[]>([]);
  const [atencionEstados, setAtencionEstados] = useState<CatalogItem[]>([]);
  const [provincias, setProvincias] = useState<CatalogItem[]>([]);
  const [cantones, setCantones] = useState<CatalogItem[]>([]);
  const [parroquias, setParroquias] = useState<CatalogItem[]>([]);

  const emergenciaId = selectedEmergenciaId || datosLogin?.emergencia_id || 0;
  const provinciaId = datosLogin?.provincia_id || 0;
  const cantonId = datosLogin?.canton_id || 0;

  const loadCatalog = useCallback(async <T,>(endpoint: string) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(endpoint);
    return unwrapArray<T>(await readJson<unknown>(response));
  }, [authFetch]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_BASE_URL}/eventos`);
      if (!response.ok) throw new Error('No se pudieron cargar los eventos adversos');
      const data = unwrapArray<EventoItem>(await readJson<unknown>(response));
      setItems(data.map((item) => ({ ...item, id: item.id || item.evento_id })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los eventos adversos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [causasData, estadosData, origenesData, tiposData, atencionData, provinciasData] = await Promise.all([
          loadCatalog<CatalogItem>('/evento-causas'),
          loadCatalog<CatalogItem>('/evento-estados'),
          loadCatalog<CatalogItem>('/evento-origenes'),
          loadCatalog<CatalogItem>('/evento-tipos'),
          loadCatalog<CatalogItem>('/evento-atencion-estados'),
          loadCatalog<CatalogItem>('/provincias'),
        ]);
        if (cancelled) return;
        setCausas(causasData);
        setEstados(estadosData);
        setOrigenes(origenesData);
        setTipos(tiposData);
        setAtencionEstados(atencionData);
        setProvincias(provinciasData);
      } catch {
        if (!cancelled) message.warning('No se pudieron cargar todos los catalogos de eventos.');
      }
    }
    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadSubtipos = useCallback(async (tipoId?: number | null) => {
    if (!tipoId) {
      setSubtipos([]);
      return;
    }
    try {
      setSubtipos(await loadCatalog<CatalogItem>(`/evento-subtipos/tipo-evento/${tipoId}`));
    } catch {
      setSubtipos([]);
    }
  }, [loadCatalog]);

  const loadCantones = useCallback(async (nextProvinciaId?: number | null) => {
    if (!nextProvinciaId) {
      setCantones([]);
      return;
    }
    try {
      setCantones(await loadCatalog<CatalogItem>(`/cantones/provincia/${nextProvinciaId}`));
    } catch {
      setCantones([]);
    }
  }, [loadCatalog]);

  const loadParroquias = useCallback(async (nextCantonId?: number | null) => {
    if (!nextCantonId) {
      setParroquias([]);
      return;
    }
    try {
      setParroquias(await loadCatalog<CatalogItem>(`/parroquias/canton/${nextCantonId}`));
    } catch {
      setParroquias([]);
    }
  }, [loadCatalog]);

  useEffect(() => {
    void loadCantones(provinciaId);
  }, [loadCantones, provinciaId]);

  useEffect(() => {
    void loadParroquias(cantonId);
  }, [cantonId, loadParroquias]);

  const resolveItemForEdit = useCallback(async (item: EventoItem) => {
    if (!item.id) return item;
    const response = await authFetch(`${API_BASE_URL}/eventos/${item.id}`);
    if (!response.ok) return item;
    const data = await readJson<EventoItem>(response);
    const normalizedItem: EventoItem = {
      ...item,
      ...data,
      id: data.id || data.evento_id || item.id,
      fecha_evento: data.evento_fecha || data.fecha_evento,
      observacion: data.descripcion ?? data.observacion,
      tipo_id: data.evento_tipo_id ?? data.tipo_id,
      subtipo_id: data.evento_subtipo_id ?? data.subtipo_id,
      causa_id: data.evento_causa_id ?? data.causa_id,
      origen_id: data.evento_origen_id ?? data.origen_id,
      atencion_estado_id: data.evento_atencion_estado_id ?? data.atencion_estado_id,
    };
    const nextProvinciaId = Number(data.provincia_id || item.provincia_id || 0);
    const nextCantonId = Number(data.canton_id || item.canton_id || 0);
    await Promise.all([
      loadSubtipos(Number(normalizedItem.tipo_id || 0)),
      loadCantones(nextProvinciaId),
      loadParroquias(nextCantonId),
    ]);
    return normalizedItem;
  }, [authFetch, loadCantones, loadParroquias, loadSubtipos]);

  const saveItem = useCallback(async (item: EventoItem) => {
    const payload = {
      emergencia_id: emergenciaId,
      evento_fecha: item.fecha_evento ? dayjs(String(item.fecha_evento)).format('YYYY-MM-DDTHH:mm:ss') : undefined,
      sector: item.sector,
      situacion: item.situacion,
      descripcion: item.observacion,
      latitud: item.latitud,
      longitud: item.longitud,
      provincia_id: item.provincia_id || provinciaId,
      canton_id: item.canton_id || cantonId,
      parroquia_id: item.parroquia_id,
      evento_tipo_id: item.tipo_id,
      evento_subtipo_id: item.subtipo_id,
      evento_causa_id: item.causa_id,
      evento_origen_id: item.origen_id,
      evento_atencion_estado_id: item.atencion_estado_id,
    };

    const required: Array<[unknown, string]> = [
      [payload.emergencia_id, 'emergencia'],
      [payload.evento_fecha, 'fecha del evento'],
      [payload.sector, 'sector'],
      [payload.situacion, 'situacion'],
      [payload.provincia_id, 'provincia'],
      [payload.canton_id, 'canton'],
      [payload.parroquia_id, 'parroquia'],
      [payload.evento_tipo_id, 'tipo'],
      [payload.evento_subtipo_id, 'subtipo'],
      [payload.evento_causa_id, 'causa'],
      [payload.evento_origen_id, 'origen'],
      [payload.latitud, 'latitud'],
      [payload.longitud, 'longitud'],
    ];
    const missing = required.find(([value]) => value === undefined || value === null || value === '');
    if (missing) throw new Error(`Debe completar ${missing[1]}.`);

    const response = await authFetch(`${API_BASE_URL}/eventos${item.id ? `/${item.id}` : ''}`, {
      method: item.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('No se pudo guardar el evento adverso');
    await loadItems();
  }, [authFetch, cantonId, emergenciaId, loadItems, provinciaId]);

  const deleteItem = useCallback(async (id: string | number) => {
    const response = await authFetch(`${API_BASE_URL}/eventos/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('No se pudo eliminar el evento adverso');
    await loadItems();
  }, [authFetch, loadItems]);

  const columns = useMemo<CrudColumn<EventoItem>[]>(() => [
    { key: 'id', header: 'ID' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'evento_causa_nombre', header: 'Causa', render: (item) => String(item.evento_causa_nombre || item.causa || '') },
    { key: 'evento_origen_nombre', header: 'Origen', render: (item) => String(item.evento_origen_nombre || item.origen || '') },
    { key: 'evento_tipo_nombre', header: 'Tipo', render: (item) => String(item.evento_tipo_nombre || item.tipo || '') },
    { key: 'evento_subtipo_nombre', header: 'Subtipo', render: (item) => String(item.evento_subtipo_nombre || item.subtipo || '') },
    { key: 'provincia_nombre', header: 'Provincia', render: (item) => String(item.provincia_nombre || item.provincia || '') },
    { key: 'canton_nombre', header: 'Cantón', render: (item) => String(item.canton_nombre || item.canton || '') },
    { key: 'parroquia_nombre', header: 'Parroquia', render: (item) => String(item.parroquia_nombre || item.parroquia || '') },
    { key: 'sector', header: 'Sector' },
    { key: 'creacion', header: 'Creación', render: (item) => item.creacion ? dayjs(String(item.creacion)).format('DD/MM/YYYY HH:mm') : '' },
    { key: 'coordenadas', header: 'Latitud / Longitud', render: (item) => item.latitud !== null && item.latitud !== undefined && item.longitud !== null && item.longitud !== undefined ? `${item.latitud}, ${item.longitud}` : '' },
    {
      key: 'afectaciones',
      header: 'Afectaciones',
      render: (item) => (
        <Button
          size="small"
          icon={<TableOutlined />}
          disabled={!item.id}
          aria-label={`Gestionar afectaciones del evento ${item.id || ''}`}
          title="Gestionar afectaciones"
          onClick={() => navigate(`/eventos-adversos/${item.id}/afectaciones`)}
        >
          Gestionar
        </Button>
      ),
    },
  ], [navigate]);

  function renderForm(item: EventoItem, setItem: (next: EventoItem) => void, readonly: boolean) {
    const update = (patch: Partial<EventoItem>) => setItem({ ...item, ...patch });
    return (
      <Form layout="vertical" className="event-form">
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Fecha del evento" required>
              <DatePicker
                className="w-100"
                disabled={readonly}
                value={item.fecha_evento ? dayjs(String(item.fecha_evento)) : null}
                onChange={(date) => update({ fecha_evento: date?.format('YYYY-MM-DD') })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Estado de atención">
              <Select allowClear disabled={readonly} value={item.atencion_estado_id ?? undefined} options={atencionEstados.map((entry) => ({ value: entry.id, label: nameOf(entry) }))} onChange={(value) => update({ atencion_estado_id: value })} />
            </Form.Item>           
          </Col>
          <Col xs={24} md={8}>
           <Form.Item label="Tipo de evento" required>
              <Select
                disabled={readonly}
                value={item.tipo_id ?? undefined}
                options={tipos.map((entry) => ({ value: entry.id, label: nameOf(entry) }))}
                onChange={(value) => {
                  update({ tipo_id: value, subtipo_id: null });
                  void loadSubtipos(value);
                }}
                placeholder="Seleccione"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Subtipo" required>
              <Select
                disabled={readonly}
                value={item.subtipo_id ?? undefined}
                options={subtipos.map((entry) => ({ value: entry.id, label: nameOf(entry) }))}
                onChange={(value) => update({ subtipo_id: value })}
                placeholder="Seleccione"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Causa" required>
              <Select disabled={readonly} value={item.causa_id ?? undefined} options={causas.map((entry) => ({ value: entry.id, label: nameOf(entry) }))} onChange={(value) => update({ causa_id: value })} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Estado" required>
              <Select disabled={readonly} value={item.estado_id ?? undefined} options={estados.map((entry) => ({ value: entry.id, label: nameOf(entry) }))} onChange={(value) => update({ estado_id: value })} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Origen" required>
              <Select disabled={readonly} value={item.origen_id ?? undefined} options={origenes.map((entry) => ({ value: entry.id, label: nameOf(entry) }))} onChange={(value) => update({ origen_id: value })} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Provincia" required>
              <Select disabled={readonly} value={item.provincia_id || provinciaId || undefined} options={provincias.map((entry) => ({ value: entry.id || entry.provincia_id, label: nameOf(entry) }))} onChange={(value) => {
                update({ provincia_id: value, canton_id: null, parroquia_id: null });
                void loadCantones(value);
                setParroquias([]);
              }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Cantón" required>
              <Select disabled={readonly} value={item.canton_id || cantonId || undefined} options={cantones.map((entry) => ({ value: entry.id || entry.canton_id, label: nameOf(entry) }))} onChange={(value) => {
                update({ canton_id: value, parroquia_id: null });
                void loadParroquias(value);
              }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Parroquia" required>
              <Select disabled={readonly} value={item.parroquia_id ?? undefined} options={parroquias.map((entry) => ({ value: entry.id || entry.parroquia_id, label: nameOf(entry) }))} onChange={(value) => update({ parroquia_id: value })} />
            </Form.Item>
          </Col>
           <Col xs={24} md={12}>
            <Form.Item label="Sector" required>
              <Input disabled={readonly} value={item.sector} onChange={(event) => update({ sector: event.target.value })} />
            </Form.Item>
          </Col>
        </Row>

      
        <Form.Item label="Ubicación" required>
          <MapSelector  
            readonly={readonly}
            latitude={Number(item.latitud || -1.05458)}
            longitude={Number(item.longitud || -80.45445)}
            onChange={(coords) => update({ latitud: coords.latitude, longitud: coords.longitude })}
          />
        </Form.Item>        
        <Form.Item label="Situación" required>
          <Input.TextArea rows={1} disabled={readonly} value={item.situacion} onChange={(event) => update({ situacion: event.target.value })} />
        </Form.Item>
        <Form.Item label="Observación">
          <Input.TextArea rows={1} disabled={readonly} value={item.observacion} onChange={(event) => update({ observacion: event.target.value })} />
        </Form.Item>
        
      </Form>

    );
  }

  return (
    <Card className="functional-card">
      {error ? <Alert className="mb-3" type="warning" showIcon message={error} description="Revise VITE_API_URL o disponibilidad del backend." /> : null}
      <Spin spinning={loading}>
        <BaseCRUD
          title="Eventos Adversos"
          itemLabel="evento adverso"
          modalWidth={540}
          items={items}
          columns={columns}
          initialItem={{
            ...emptyEvento,
            provincia_id: provinciaId || null,
            canton_id: cantonId || null,
            emergencia_id: emergenciaId || null,
          }}
          onSave={saveItem}
          onDelete={deleteItem}
          renderForm={renderForm}
          resolveItemForEdit={resolveItemForEdit}
        />
      </Spin>
    </Card>
  );
}
