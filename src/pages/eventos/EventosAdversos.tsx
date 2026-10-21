import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, Input, Row, Select, Spin, Switch, Tag, message } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { BaseCRUD, type CrudColumn } from '../../components/crud/BaseCRUD';
import { MapSelector } from '../../components/map/MapSelector';

type Id = number | string;

type CatalogItem = {
  id?: Id;
  nombre?: string;
  descripcion?: string;
  dpa?: string;
  provincia_id?: Id;
  canton_id?: Id;
  parroquia_id?: Id;
  [key: string]: unknown;
};

type InfraestructuraItem = {
  id?: Id;
  infraestructura_id?: Id;
  nombre?: string;
  descripcion?: string;
  recinto?: string;
  institucion?: string | null;
  direccion?: string;
  latitud?: number | string | null;
  longitud?: number | string | null;
  [key: string]: unknown;
};

type EventoItem = {
  id?: Id;
  evento_id?: Id;
  activo?: boolean;
  alto_impacto?: boolean;
  infraestructura_id?: Id | null;
  fecha_evento?: string;
  evento_fecha?: string;
  sector?: string;
  situacion?: string;
  descripcion?: string;
  observacion?: string;
  latitud?: number | null;
  longitud?: number | null;
  provincia_id?: number | null;
  canton_id?: number | null;
  parroquia_id?: number | null;
  tipo_id?: number | null;
  subtipo_id?: number | null;
  causa_id?: number | null;
  origen_id?: number | null;
  atencion_estado_id?: number | null;
  evento_tipo_id?: number | null;
  evento_subtipo_id?: number | null;
  evento_causa_id?: number | null;
  evento_origen_id?: number | null;
  evento_atencion_estado_id?: number | null;
  evento_id_redm?: number;
  emergencia_id?: number | null;
  provincia?: string;
  canton?: string;
  parroquia?: string;
  tipo?: string;
  subtipo?: string;
  causa?: string;
  origen?: string;
  atencion_estado?: string;
  atencion_estado_nombre?: string;
  evento_atencion_estado?: string;
  evento_atencion_estado_nombre?: string;
  infraestructura_nombre?: string;
  infraestructura?: string;
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

function infrastructureTypeIdForEmergency(emergencyName?: string | null) {
  const normalizedName = String(emergencyName || '').trim().toUpperCase();
  if (normalizedName.includes('PPL')) return 1;
  if (normalizedName.includes('VOTO EN CASA') || /\bVC\b/.test(normalizedName)) return 2;
  return 3;
}

const emptyEvento: EventoItem = {
  activo: true,
  alto_impacto: false,
  fecha_evento: dayjs().format('YYYY-MM-DDTHH:mm:ssZ'),
  sector: '',
  situacion: '',
  descripcion: '',
  latitud: -1.05458,
  longitud: -80.45445,
  provincia_id: null,
  canton_id: null,
  parroquia_id: null,
  infraestructura_id: null,
  tipo_id: null,
  subtipo_id: null,
  causa_id: null,
  atencion_estado_id: 1,
};

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result || record?.registros || record?.detalle || record?.detalles;
  if (Array.isArray(candidate)) return candidate as T[];
  return record && typeof record === 'object' && Object.keys(record).length ? [record as T] : [];
}

function nameOf(item: CatalogItem) {
  return item.nombre || item.descripcion || String(item.id || '');
}

function infraestructuraId(item: InfraestructuraItem) {
  return item.infraestructura_id || item.id;
}

function infraestructuraName(item: InfraestructuraItem) {
  return item.nombre || item.recinto || item.descripcion || item.institucion || `Infraestructura ${infraestructuraId(item) || ''}`;
}

function toNumericId(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
}

function toFiniteNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function optionValueOf(item: CatalogItem) {
  return toNumericId(item.id || item.provincia_id || item.canton_id || item.parroquia_id);
}

function sameText(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase());
}

function selectedNameOf(item: EventoItem, nameKey: 'provincia_nombre' | 'canton_nombre' | 'parroquia_nombre', fallbackKey: 'provincia' | 'canton' | 'parroquia') {
  return String(item[nameKey] || item[fallbackKey] || '').trim();
}

function resolveCatalogValue(value: unknown, entries: CatalogItem[], selectedName?: string) {
  const numericValue = toNumericId(value);
  const matchingEntry = entries.find((entry) => {
    const optionValue = optionValueOf(entry);
    return optionValue === numericValue || sameText(nameOf(entry), selectedName);
  });
  return matchingEntry ? optionValueOf(matchingEntry) : numericValue;
}

function itemLocationName(item: EventoItem, nameKey: 'provincia_nombre' | 'canton_nombre' | 'parroquia_nombre', fallbackKey: 'provincia' | 'canton' | 'parroquia') {
  return String(item[nameKey] || item[fallbackKey] || '').trim();
}

function itemInfraestructuraName(item: EventoItem) {
  return String(item.infraestructura_nombre || item.infraestructura || item.infraestructura_id || '').trim();
}

function itemTipoName(item: EventoItem) {
  return String(item.evento_tipo_nombre || item.tipo || '').trim();
}

function matchesOptionFilter(value: unknown, selectedValue: unknown, itemName: string, entries: CatalogItem[]) {
  if (selectedValue === undefined || selectedValue === null || selectedValue === '') return true;
  if (String(value ?? '') === String(selectedValue)) return true;
  const selectedEntry = entries.find((entry) => String(optionValueOf(entry)) === String(selectedValue));
  return selectedEntry ? sameText(nameOf(selectedEntry), itemName) : false;
}

function selectOptions(entries: CatalogItem[], selectedValue?: number, selectedName?: string) {
  const options = entries
    .map((entry) => ({ value: optionValueOf(entry), label: nameOf(entry) }))
    .filter((option): option is { value: number; label: string } => option.value !== undefined);
  if (selectedValue !== undefined && selectedName && !options.some((option) => option.value === selectedValue)) {
    return [{ value: selectedValue, label: selectedName }, ...options];
  }
  return options;
}

function lockedProvinceOptions(entries: CatalogItem[], selectedValue: number, selectedName?: string) {
  const matchingProvince = entries.find((entry) => optionValueOf(entry) === selectedValue || sameText(nameOf(entry), selectedName));
  return [{
    value: selectedValue,
    label: matchingProvince ? nameOf(matchingProvince) : selectedName || `Provincia ${selectedValue}`,
  }];
}

function buildSelectOptions<T>(entries: T[], valueOf: (item: T) => Id | number | undefined, labelOf: (item: T) => string, selectedValue?: Id | null, selectedLabel?: string) {
  const options = entries
    .map((entry) => {
      const value = valueOf(entry);
      return value === undefined || value === null || value === '' ? null : { value, label: labelOf(entry) };
    })
    .filter((option): option is { value: Id | number; label: string } => option !== null);
  if (selectedValue !== undefined && selectedValue !== null && selectedLabel && !options.some((option) => String(option.value) === String(selectedValue))) {
    return [{ value: selectedValue, label: selectedLabel }, ...options];
  }
  return options;
}

function uniqueItemOptions<T>(entries: T[], valueOf: (item: T) => unknown, labelOf: (item: T) => string): Array<{ value: Id; label: string }> {
  const seen = new Set<string>();
  return entries
    .map((entry) => {
      const value = valueOf(entry);
      const label = labelOf(entry);
      if ((typeof value !== 'string' && typeof value !== 'number') || value === '' || !label) return null;
      return { value, label };
    })
    .filter((option): option is { value: Id; label: string } => option !== null)
    .filter((option) => {
      const key = `${option.value}-${option.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function dateValueOf(item: EventoItem) {
  return item.evento_fecha || item.fecha_evento;
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

const EVENT_DATE_BY_EMERGENCY_ID: Record<number, string> = {
  1: '2026-11-26', // PROCESO ELECTORAL 2026 PPL
  2: '2026-11-27', // PROCESO ELECTORAL 2026 VC
  3: '2026-11-29', // PROCESO ELECTORAL 2026 G
};

function eventDateForEmergencyId(emergencyId: number | null) {
  const date = emergencyId ? EVENT_DATE_BY_EMERGENCY_ID[emergencyId] : undefined;
  return date ? dayjs(date) : null;
}

function atencionEstadoName(item: EventoItem, atencionEstados: CatalogItem[]) {
  const catalogEntry = atencionEstados.find((entry) => String(entry.id) === String(item.evento_atencion_estado_id ?? item.atencion_estado_id));
  return String(
    item.evento_atencion_estado_nombre
    || item.atencion_estado_nombre
    || item.evento_atencion_estado
    || item.atencion_estado
    || (catalogEntry ? nameOf(catalogEntry) : '')
    || ''
  );
}

function atencionEstadoColor(value: string) {
  const status = normalizeText(value);
  if (status.includes('iniciada')) return { color: '#0958d9', background: '#e6f4ff', border: '#69b1ff' };
  if (status.includes('media') || status.includes('proceso')) return { color: '#c2410c', background: '#fff7e6', border: '#ffa940' };
  if (status.includes('finalizada')) return { color: '#237804', background: '#f6ffed', border: '#73d13d' };
  if (status.includes('suspendida')) return { color: '#a8071a', background: '#fff1f0', border: '#ff7875' };
  if (status.includes('permanente')) return { color: '#531dab', background: '#f9f0ff', border: '#b37feb' };
  return { color: '#455560', background: '#f5f7fa', border: '#b8c2cc' };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function EventosAdversos() {
  const navigate = useNavigate();
  const { authFetch, datosLogin, loginResponse, selectedEmergencia, selectedEmergenciaId } = useAuth();
  const [items, setItems] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [causas, setCausas] = useState<CatalogItem[]>([]);
  const [tipos, setTipos] = useState<CatalogItem[]>([]);
  const [subtipos, setSubtipos] = useState<CatalogItem[]>([]);
  const [atencionEstados, setAtencionEstados] = useState<CatalogItem[]>([]);
  const [provincias, setProvincias] = useState<CatalogItem[]>([]);
  const [cantones, setCantones] = useState<CatalogItem[]>([]);
  const [parroquias, setParroquias] = useState<CatalogItem[]>([]);
  const [infraestructuras, setInfraestructuras] = useState<InfraestructuraItem[]>([]);
  const [infraestructurasLoading, setInfraestructurasLoading] = useState(false);
  const [adminFilters, setAdminFilters] = useState({
    provincia_id: undefined as number | undefined,
    canton_id: undefined as number | undefined,
    parroquia_id: undefined as number | undefined,
    infraestructura_id: undefined as Id | undefined,
    tipo_id: undefined as number | undefined,
  });
  const [adminCantones, setAdminCantones] = useState<CatalogItem[]>([]);
  const [adminParroquias, setAdminParroquias] = useState<CatalogItem[]>([]);

  const emergenciaId = Number(selectedEmergenciaId || datosLogin?.emergencia_id || localStorage.getItem('selectedEmergenciaId') || 0);
  const recintoInfraestructuraTipoId = useMemo(
    () => infrastructureTypeIdForEmergency(selectedEmergencia?.emergencia || localStorage.getItem('selectedEmergenciaName')),
    [selectedEmergencia?.emergencia],
  );
  const institucionId = Number(datosLogin?.institucion_id || loginResponse?.usuario?.institucion_id || 0);
  const provinciaId = Number(datosLogin?.provincia_id || 0);
  const usuarioLogin = String(datosLogin?.usuario_login || datosLogin?.usuario || '').trim();
  const isAdmin = provinciaId === 0;
  const administratorAliases = ['admin', 'administrador'];
  const isAdminUser = administratorAliases.some((alias) => usuarioLogin.localeCompare(alias, 'es', { sensitivity: 'base' }) === 0);
  const showProvinceColumn = [datosLogin?.perfil_nombre, datosLogin?.usuario_login, datosLogin?.usuario, datosLogin?.nombres]
    .some((value) => administratorAliases.some((alias) => String(value || '').trim().localeCompare(alias, 'es', { sensitivity: 'base' }) === 0));
  const cantonId = Number(datosLogin?.canton_id || 0);
  const allowedEventDate = useMemo(() => eventDateForEmergencyId(selectedEmergenciaId), [selectedEmergenciaId]);

  const loadCatalog = useCallback(async <T,>(endpoint: string) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(endpoint);
    return unwrapArray<T>(await readJson<unknown>(response));
  }, [authFetch]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isAdminUser
        ? `${API_BASE_URL}/eventos`
        : `${API_BASE_URL}/eventos/provincia/${provinciaId}/usuario/${encodeURIComponent(usuarioLogin)}`;
      const response = await authFetch(endpoint);
      if (!response.ok) throw new Error('No se pudieron cargar los eventos adversos');
      const data = unwrapArray<EventoItem>(await readJson<unknown>(response));
      setItems(data.map((item) => ({ ...item, id: item.id || item.evento_id })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los eventos adversos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAdminUser, provinciaId, usuarioLogin]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [causasData, tiposData, atencionData, provinciasData] = await Promise.all([
          loadCatalog<CatalogItem>('/evento-causas'),
          loadCatalog<CatalogItem>(`/evento-tipos/institucion/${institucionId}`),
          loadCatalog<CatalogItem>('/evento-atencion-estados'),
          loadCatalog<CatalogItem>('/provincias'),
        ]);
        if (cancelled) return;
        setCausas(causasData);
        setTipos(tiposData);
        setAtencionEstados(atencionData);
        setProvincias(provinciasData);
        if (isAdmin) {
          const allCantones = (await Promise.all(provinciasData.map((provincia) => {
            const nextProvinciaId = optionValueOf(provincia);
            return nextProvinciaId ? loadCatalog<CatalogItem>(`/cantones/provincia/${nextProvinciaId}`).catch(() => []) : Promise.resolve([]);
          }))).flat();
          if (!cancelled) setAdminCantones(allCantones);
        }
      } catch {
        if (!cancelled) message.warning('No se pudieron cargar todos los catalogos de eventos.');
      }
    }
    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [institucionId, isAdmin, loadCatalog]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadSubtipos = useCallback(async (tipoId?: number | null) => {
    if (!tipoId) {
      setSubtipos([]);
      return [];
    }
    try {
      const data = await loadCatalog<CatalogItem>(`/evento-subtipos/tipo-evento/${tipoId}`);
      setSubtipos(data);
      return data;
    } catch {
      setSubtipos([]);
      return [];
    }
  }, [loadCatalog]);

  const loadCantones = useCallback(async (nextProvinciaId?: number | null) => {
    if (!nextProvinciaId) {
      setCantones([]);
      return [];
    }
    try {
      const data = await loadCatalog<CatalogItem>(`/cantones/provincia/${nextProvinciaId}`);
      setCantones(data);
      return data;
    } catch {
      setCantones([]);
      return [];
    }
  }, [loadCatalog]);

  const loadParroquias = useCallback(async (nextCantonId?: number | null) => {
    if (!nextCantonId) {
      setParroquias([]);
      return [];
    }
    try {
      const data = await loadCatalog<CatalogItem>(`/parroquias/canton/${nextCantonId}`);
      setParroquias(data);
      return data;
    } catch {
      setParroquias([]);
      return [];
    }
  }, [loadCatalog]);

  const loadInfraestructuras = useCallback(async (parroquiaId?: number | null) => {
    if (!parroquiaId) {
      setInfraestructuras([]);
      return [];
    }
    setInfraestructurasLoading(true);
    try {
      const data = await loadCatalog<InfraestructuraItem>(`/infraestructuras/parroquia/${parroquiaId}/infraestructura_tipo/${recintoInfraestructuraTipoId}`);
      setInfraestructuras(data);
      return data;
    } catch {
      setInfraestructuras([]);
      return [];
    } finally {
      setInfraestructurasLoading(false);
    }
  }, [loadCatalog, recintoInfraestructuraTipoId]);

  useEffect(() => {
    void loadCantones(provinciaId);
  }, [loadCantones, provinciaId]);

  useEffect(() => {
    void loadParroquias(cantonId);
  }, [cantonId, loadParroquias]);

  const resolveItemForEdit = useCallback(async (item: EventoItem) => {
    const itemId = item.id || item.evento_id;
    const data = itemId
      ? await authFetch(`${API_BASE_URL}/eventos/${itemId}`).then(async (response) => (response.ok ? readJson<EventoItem>(response) : item))
      : item;

    const normalizedItem: EventoItem = {
      ...item,
      ...data,
      id: data.id || data.evento_id || item.id,
      fecha_evento: data.evento_fecha || data.fecha_evento,
      descripcion: data.descripcion ?? data.observacion ?? item.descripcion,
      tipo_id: data.evento_tipo_id ?? data.tipo_id,
      subtipo_id: data.evento_subtipo_id ?? data.subtipo_id,
      causa_id: data.evento_causa_id ?? data.causa_id,
      atencion_estado_id: data.evento_atencion_estado_id ?? data.atencion_estado_id,
      infraestructura_id: data.infraestructura_id ?? item.infraestructura_id ?? null,
      activo: data.activo ?? item.activo ?? true,
      alto_impacto: data.alto_impacto ?? item.alto_impacto ?? false,
    };
    const provinciaName = selectedNameOf(normalizedItem, 'provincia_nombre', 'provincia');
    const cantonName = selectedNameOf(normalizedItem, 'canton_nombre', 'canton');
    const parroquiaName = selectedNameOf(normalizedItem, 'parroquia_nombre', 'parroquia');
    const nextProvinciaId = resolveCatalogValue(data.provincia_id ?? item.provincia_id, provincias, provinciaName);
    const [, nextCantones] = await Promise.all([
      loadSubtipos(Number(normalizedItem.tipo_id || 0)),
      loadCantones(nextProvinciaId),
    ]);
    const nextCantonId = resolveCatalogValue(data.canton_id ?? item.canton_id, nextCantones, cantonName);
    const nextParroquias = await loadParroquias(nextCantonId);
    const nextParroquiaId = resolveCatalogValue(data.parroquia_id ?? item.parroquia_id, nextParroquias, parroquiaName);
    await loadInfraestructuras(nextParroquiaId);
    return {
      ...normalizedItem,
      provincia_id: nextProvinciaId ?? normalizedItem.provincia_id,
      canton_id: nextCantonId ?? normalizedItem.canton_id,
      parroquia_id: nextParroquiaId ?? normalizedItem.parroquia_id,
    };
  }, [authFetch, loadCantones, loadInfraestructuras, loadParroquias, loadSubtipos, provincias]);

  const saveItem = useCallback(async (item: EventoItem) => {
    const payload = {
      activo: item.activo ?? true,
      alto_impacto: item.alto_impacto ?? false,
      canton_id: toNumericId(item.canton_id) || cantonId,
      descripcion: item.descripcion || item.observacion || '',
      emergencia_id: emergenciaId,
      evento_atencion_estado_id: toNumericId(item.atencion_estado_id) || 1,
      evento_causa_id: toNumericId(item.causa_id),
      evento_fecha: dateValueOf(item) ? dayjs(String(dateValueOf(item))).format('YYYY-MM-DDTHH:mm:ssZ') : undefined,
      evento_id_redm: Number(item.evento_id_redm || 0),
      evento_origen_id: null,
      evento_subtipo_id: toNumericId(item.subtipo_id),
      evento_tipo_id: toNumericId(item.tipo_id),
      infraestructura_id: toNumericId(item.infraestructura_id),
      latitud: toFiniteNumber(item.latitud),
      longitud: toFiniteNumber(item.longitud),
      parroquia_id: toNumericId(item.parroquia_id),
      provincia_id: toNumericId(item.provincia_id) || provinciaId,
      sector: item.sector || '',
      situacion: item.situacion || '',
    };

    const required: Array<[unknown, string]> = [
      [payload.emergencia_id, 'emergencia'],
      [payload.evento_fecha, 'fecha del evento'],
      [payload.provincia_id, 'provincia'],
      [payload.canton_id, 'canton'],
      [payload.parroquia_id, 'parroquia'],
      [payload.infraestructura_id, 'recinto'],
      [payload.evento_tipo_id, 'tipo'],
      [payload.evento_causa_id, 'causa'],
      [payload.latitud, 'latitud'],
      [payload.longitud, 'longitud'],
      [payload.sector, 'sector'],
      [payload.situacion, 'situacion'],
    ];
    const missing = required.find(([value]) => value === undefined || value === null || value === '' || Number.isNaN(value));
    if (missing) throw new Error(`Debe completar ${missing[1]}.`);
    if (allowedEventDate && !dayjs(String(payload.evento_fecha)).isSame(allowedEventDate, 'day')) {
      throw new Error(`La fecha del evento debe ser ${allowedEventDate.format('DD/MM/YYYY')}.`);
    }

    const response = await authFetch(`${API_BASE_URL}/eventos${item.id ? `/${item.id}` : ''}`, {
      method: item.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('No se pudo guardar el evento adverso');
    await loadItems();
  }, [allowedEventDate, authFetch, cantonId, emergenciaId, loadItems, provinciaId]);

  const deleteItem = useCallback(async (id: Id) => {
    const response = await authFetch(`${API_BASE_URL}/eventos/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('No se pudo eliminar el evento adverso');
    await loadItems();
  }, [authFetch, loadItems]);

  const columns = useMemo<CrudColumn<EventoItem>[]>(() => [
    { key: 'id', header: 'ID' },
    ...(showProvinceColumn ? [{ key: 'provincia_nombre', header: 'Provincia', render: (item: EventoItem) => String(item.provincia_nombre || item.provincia || ''), sortValue: (item: EventoItem) => item.provincia_nombre || item.provincia || '' }] : []),
    { key: 'canton_nombre', header: 'Canton', render: (item) => String(item.canton_nombre || item.canton || ''), sortValue: (item) => item.canton_nombre || item.canton || '' },
    { key: 'parroquia_nombre', header: 'Parroquia', render: (item) => String(item.parroquia_nombre || item.parroquia || ''), sortValue: (item) => item.parroquia_nombre || item.parroquia || '' },
    { key: 'infraestructura_nombre', header: 'Recinto', render: (item) => String(item.infraestructura_nombre || item.infraestructura || item.infraestructura_id || ''), sortValue: (item) => item.infraestructura_nombre || item.infraestructura || item.infraestructura_id || '' },
    { key: 'evento_fecha', header: 'Fecha', render: (item) => dateValueOf(item) ? dayjs(String(dateValueOf(item))).format('DD/MM/YYYY HH:mm') : '', sortValue: (item) => dateValueOf(item) ? dayjs(String(dateValueOf(item))).valueOf() : null },
    { key: 'sector', header: 'Sector' },
    { key: 'evento_tipo_nombre', header: 'Tipo Evento', render: (item) => String(item.evento_tipo_nombre || item.tipo || ''), sortValue: (item) => item.evento_tipo_nombre || item.tipo || '' },
    {
      key: 'atencion_estado',
      header: 'Estado de Atencion',
      sortValue: (item) => atencionEstadoName(item, atencionEstados),
      render: (item) => {
        const estado = atencionEstadoName(item, atencionEstados);
        const estadoStyle = atencionEstadoColor(estado);
        return estado ? (
          <Tag
            style={{
              color: estadoStyle.color,
              backgroundColor: estadoStyle.background,
              borderColor: estadoStyle.border,
              borderWidth: 1,
              fontWeight: 700,
              padding: '2px 8px',
            }}
          >
            {estado}
          </Tag>
        ) : '';
      },
    },
    {
      key: 'matriz_afectaciones',
      header: 'Matriz Afectaciones',
      sortValue: (item) => item.id ? 1 : 0,
      render: (item) => item.id ? (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<TableOutlined />}
          aria-label={`Abrir matriz de afectaciones del evento ${item.id}`}
          onClick={() => navigate(`/eventos-adversos/${item.id}/afectaciones`)}
        >
          Matriz
        </Button>
      ) : null,
    },
  ], [atencionEstados, navigate, showProvinceColumn]);

  const adminBaseFilteredItems = useMemo(() => {
    if (!isAdmin) return items;
    return items.filter((item) => (
      matchesOptionFilter(item.provincia_id, adminFilters.provincia_id, itemLocationName(item, 'provincia_nombre', 'provincia'), provincias)
      && matchesOptionFilter(item.canton_id, adminFilters.canton_id, itemLocationName(item, 'canton_nombre', 'canton'), adminCantones)
      && matchesOptionFilter(item.parroquia_id, adminFilters.parroquia_id, itemLocationName(item, 'parroquia_nombre', 'parroquia'), adminParroquias)
      && matchesOptionFilter(item.evento_tipo_id ?? item.tipo_id, adminFilters.tipo_id, itemTipoName(item), tipos)
    ));
  }, [adminCantones, adminFilters.canton_id, adminFilters.parroquia_id, adminFilters.provincia_id, adminFilters.tipo_id, adminParroquias, isAdmin, items, provincias, tipos]);

  const adminRecintoOptions = useMemo(() => uniqueItemOptions(
    adminBaseFilteredItems,
    (item) => item.infraestructura_id ?? itemInfraestructuraName(item),
    itemInfraestructuraName,
  ), [adminBaseFilteredItems]);

  const visibleItems = useMemo(() => {
    if (!isAdmin) return items;
    return adminBaseFilteredItems.filter((item) => {
      if (adminFilters.infraestructura_id === undefined) return true;
      return String(item.infraestructura_id ?? itemInfraestructuraName(item)) === String(adminFilters.infraestructura_id);
    });
  }, [adminBaseFilteredItems, adminFilters.infraestructura_id, isAdmin, items]);

  const reloadAdminCantones = useCallback(async (nextProvinciaId?: number) => {
    if (nextProvinciaId) {
      const data = await loadCatalog<CatalogItem>(`/cantones/provincia/${nextProvinciaId}`).catch(() => []);
      setAdminCantones(data);
      return;
    }
    const allCantones = (await Promise.all(provincias.map((provincia) => {
      const currentProvinciaId = optionValueOf(provincia);
      return currentProvinciaId ? loadCatalog<CatalogItem>(`/cantones/provincia/${currentProvinciaId}`).catch(() => []) : Promise.resolve([]);
    }))).flat();
    setAdminCantones(allCantones);
  }, [loadCatalog, provincias]);

  const updateAdminProvincia = useCallback((value?: number) => {
    setAdminFilters((current) => ({
      ...current,
      provincia_id: value,
      canton_id: undefined,
      parroquia_id: undefined,
      infraestructura_id: undefined,
    }));
    setAdminParroquias([]);
    void reloadAdminCantones(value);
  }, [reloadAdminCantones]);

  const updateAdminCanton = useCallback((value?: number) => {
    setAdminFilters((current) => ({
      ...current,
      canton_id: value,
      parroquia_id: undefined,
      infraestructura_id: undefined,
    }));
    if (!value) {
      setAdminParroquias([]);
      return;
    }
    void loadCatalog<CatalogItem>(`/parroquias/canton/${value}`)
      .then(setAdminParroquias)
      .catch(() => setAdminParroquias([]));
  }, [loadCatalog]);

  function renderForm(item: EventoItem, setItem: (next: EventoItem) => void, readonly: boolean) {
    const update = (patch: Partial<EventoItem>) => setItem({ ...item, ...patch });
    const provinciaValue = toNumericId(item.provincia_id);
    const cantonValue = toNumericId(item.canton_id);
    const parroquiaValue = toNumericId(item.parroquia_id);
    const infraestructuraValue = item.infraestructura_id ?? undefined;
    const provinciaName = selectedNameOf(item, 'provincia_nombre', 'provincia');
    const cantonName = selectedNameOf(item, 'canton_nombre', 'canton');
    const parroquiaName = selectedNameOf(item, 'parroquia_nombre', 'parroquia');
    const effectiveProvinciaValue = isAdmin ? provinciaValue : provinciaId || provinciaValue;
    const effectiveProvinciaName = isAdmin ? provinciaName : provinciaName || String(datosLogin?.provincia_nombre || '');
    const provinciaOptions = isAdmin
      ? selectOptions(provincias, effectiveProvinciaValue, effectiveProvinciaName)
      : effectiveProvinciaValue ? lockedProvinceOptions(provincias, effectiveProvinciaValue, effectiveProvinciaName) : [];
    const selectedInfraestructuraName = String(item.infraestructura_nombre || item.infraestructura || '').trim();
    return (
      <Form layout="vertical" className="event-form">
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Fecha del evento" required>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                className="w-100"
                disabled={readonly}
                disabledDate={(current) => Boolean(allowedEventDate && !current.isSame(allowedEventDate, 'day'))}
                defaultPickerValue={allowedEventDate || undefined}
                value={dateValueOf(item) ? dayjs(String(dateValueOf(item))) : null}
                onChange={(date) => update({ fecha_evento: date?.second(0).format('YYYY-MM-DDTHH:mm:ssZ') })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Estado de atencion">
              <Select allowClear showSearch optionFilterProp="label" disabled={readonly} value={item.atencion_estado_id ?? undefined} options={atencionEstados.map((entry) => ({ value: entry.id, label: nameOf(entry) }))} onChange={(value) => update({ atencion_estado_id: toNumericId(value) ?? null })} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Alto impacto">
              <Switch disabled={readonly} checked={item.alto_impacto ?? false} onChange={(checked) => update({ alto_impacto: checked })} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Tipo de evento" required>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={readonly}
                value={item.tipo_id ?? undefined}
                options={tipos.map((entry) => ({ value: entry.id, label: nameOf(entry) }))}
                onChange={(value) => {
                  update({ tipo_id: toNumericId(value) ?? null, subtipo_id: null });
                  void loadSubtipos(toNumericId(value));
                }}
                placeholder="Seleccione"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Subtipo">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={readonly}
                value={item.subtipo_id ?? undefined}
                options={subtipos.map((entry) => ({ value: entry.id, label: nameOf(entry) }))}
                onChange={(value) => update({ subtipo_id: toNumericId(value) ?? null })}
                placeholder="Seleccione"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Causa" required>
              <Select showSearch optionFilterProp="label" disabled={readonly} value={item.causa_id ?? undefined} options={causas.map((entry) => ({ value: entry.id, label: nameOf(entry) }))} onChange={(value) => update({ causa_id: toNumericId(value) ?? null })} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Provincia" required>
              <Select showSearch optionFilterProp="label" disabled={readonly || !isAdmin} value={effectiveProvinciaValue} options={provinciaOptions} onChange={(value) => {
                update({ provincia_id: value, canton_id: null, parroquia_id: null, infraestructura_id: null, latitud: null, longitud: null });
                void loadCantones(value);
                setParroquias([]);
                setInfraestructuras([]);
              }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Canton" required>
              <Select showSearch optionFilterProp="label" disabled={readonly} value={cantonValue} options={selectOptions(cantones, cantonValue, cantonName)} onChange={(value) => {
                update({ canton_id: value, parroquia_id: null, infraestructura_id: null, latitud: null, longitud: null });
                void loadParroquias(value);
                setInfraestructuras([]);
              }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Parroquia" required>
              <Select showSearch optionFilterProp="label" disabled={readonly} value={parroquiaValue} options={selectOptions(parroquias, parroquiaValue, parroquiaName)} onChange={(value) => {
                update({ parroquia_id: value, infraestructura_id: null, latitud: null, longitud: null });
                void loadInfraestructuras(value);
              }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Recinto electoral" required>
              <Select
                showSearch
                disabled={readonly || !parroquiaValue}
                loading={infraestructurasLoading}
                value={infraestructuraValue}
                options={buildSelectOptions(infraestructuras, infraestructuraId, infraestructuraName, item.infraestructura_id, selectedInfraestructuraName)}
                optionFilterProp="label"
                placeholder="Seleccione"
                onChange={(value) => {
                  const selected = infraestructuras.find((infraestructura) => String(infraestructuraId(infraestructura)) === String(value));
                  update({
                    infraestructura_id: value,
                    latitud: selected?.latitud !== undefined && selected?.latitud !== null ? Number(selected.latitud) : item.latitud,
                    longitud: selected?.longitud !== undefined && selected?.longitud !== null ? Number(selected.longitud) : item.longitud,
                  });
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Sector" required>
              <Input disabled={readonly} value={item.sector} onChange={(event) => update({ sector: event.target.value })} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Antecedentes">
          <Input disabled={readonly} value={item.descripcion} onChange={(event) => update({ descripcion: event.target.value })} />
        </Form.Item>

        <Form.Item label="Ubicacion del recinto" required>
          <MapSelector
            readonly
            latitude={Number(item.latitud ?? -1.05458)}
            longitude={Number(item.longitud ?? -80.45445)}
            onChange={() => undefined}
          />
        </Form.Item>

        <Form.Item label="Situación Actual" required>
          <Input.TextArea rows={2} disabled={readonly} value={item.situacion} onChange={(event) => update({ situacion: event.target.value })} />
        </Form.Item>
      </Form>
    );
  }

  return (
    <Card className="functional-card">
      {error ? <Alert className="mb-3" type="warning" showIcon message={error} description="Revise VITE_API_URL o disponibilidad del backend." /> : null}
      <Spin spinning={loading}>
        {isAdmin ? (
          <div className="eventos-admin-filters">
            <div className="eventos-admin-filters__header">
              <div>
                <span className="eyebrow">Filtros administrativos</span>
                <strong>Consulta eventos por ubicacion y tipo</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminFilters({
                    provincia_id: undefined,
                    canton_id: undefined,
                    parroquia_id: undefined,
                    infraestructura_id: undefined,
                    tipo_id: undefined,
                  });
                  setAdminParroquias([]);
                  void reloadAdminCantones();
                }}
              >
                Limpiar filtros
              </button>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12} xl={5}>
                <label>
                  Provincia
                  <Select
                    allowClear
                    showSearch
                    value={adminFilters.provincia_id}
                    options={selectOptions(provincias)}
                    optionFilterProp="label"
                    placeholder="Provincia"
                    onChange={(value) => updateAdminProvincia(toNumericId(value))}
                  />
                </label>
              </Col>
              <Col xs={24} md={12} xl={5}>
                <label>
                  Canton
                  <Select
                    allowClear
                    showSearch
                    value={adminFilters.canton_id}
                    options={selectOptions(adminCantones)}
                    optionFilterProp="label"
                    placeholder="Canton"
                    onChange={(value) => updateAdminCanton(toNumericId(value))}
                  />
                </label>
              </Col>
              <Col xs={24} md={12} xl={5}>
                <label>
                  Parroquia
                  <Select
                    allowClear
                    showSearch
                    value={adminFilters.parroquia_id}
                    options={selectOptions(adminParroquias)}
                    optionFilterProp="label"
                    placeholder="Parroquia"
                    onChange={(value) => setAdminFilters((current) => ({ ...current, parroquia_id: toNumericId(value), infraestructura_id: undefined }))}
                  />
                </label>
              </Col>
              <Col xs={24} md={12} xl={5}>
                <label>
                  Recinto
                  <Select
                    allowClear
                    showSearch
                    value={adminFilters.infraestructura_id}
                    options={adminRecintoOptions}
                    optionFilterProp="label"
                    placeholder="Recinto"
                    onChange={(value) => setAdminFilters((current) => ({ ...current, infraestructura_id: value as Id | undefined }))}
                  />
                </label>
              </Col>
              <Col xs={24} md={12} xl={4}>
                <label>
                  Tipo evento
                  <Select
                    allowClear
                    showSearch
                    value={adminFilters.tipo_id}
                    options={selectOptions(tipos)}
                    optionFilterProp="label"
                    placeholder="Tipo"
                    onChange={(value) => setAdminFilters((current) => ({ ...current, tipo_id: toNumericId(value) }))}
                  />
                </label>
              </Col>
            </Row>
          </div>
        ) : null}
        <BaseCRUD
          title="Eventos Adversos"
          itemLabel="evento adverso"
          modalWidth={1200}
          items={visibleItems}
          columns={columns}
          initialItem={{
            ...emptyEvento,
            fecha_evento: undefined,
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
