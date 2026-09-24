import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Select, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import L from 'leaflet';
import {
  Activity,
  Ban,
  Bridge,
  Building2,
  HeartPulse,
  Home,
  Landmark,
  OctagonX,
  PawPrint,
  Route,
  Sprout,
  TriangleAlert,
  UserX,
  Users,
  UsersRound,
  Vote,
  Warehouse,
  Wheat,
} from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';

type Id = number | string;

type EventoItem = {
  id?: Id;
  evento_id?: Id;
  provincia_id?: Id | null;
  canton_id?: Id | null;
  parroquia_id?: Id | null;
  evento_tipo_id?: Id | null;
  tipo_id?: Id | null;
  estado_id?: Id | null;
  evento_estado_id?: Id | null;
  evento_atencion_estado_id?: Id | null;
  atencion_estado_id?: Id | null;
  evento_fecha?: string;
  fecha_evento?: string;
  creacion?: string;
  provincia?: string;
  provincia_nombre?: string;
  canton?: string;
  canton_nombre?: string;
  parroquia?: string;
  parroquia_nombre?: string;
  infraestructura?: string;
  infraestructura_nombre?: string;
  evento_tipo_nombre?: string;
  tipo?: string;
  evento_subtipo_nombre?: string;
  subtipo?: string;
  estado?: string;
  estado_nombre?: string;
  evento_estado?: string;
  evento_estado_nombre?: string;
  atencion_estado?: string;
  atencion_estado_nombre?: string;
  evento_atencion_estado?: string;
  evento_atencion_estado_nombre?: string;
  sector?: string;
  descripcion?: string;
  observacion?: string;
  latitud?: number | string | null;
  longitud?: number | string | null;
  [key: string]: unknown;
};

type CatalogItem = {
  id?: Id;
  nombre?: string;
  descripcion?: string;
  provincia_id?: Id;
  canton_id?: Id;
  parroquia_id?: Id;
  evento_tipo_id?: Id;
  evento_estado_id?: Id;
  [key: string]: unknown;
};

type FilterValue = Id | undefined;

type ChartDatum = {
  label: string;
  value: number;
};

type StackedDatum = {
  label: string;
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
};

type DashboardView = 'eventos' | 'afectaciones';

type AfectacionesProvinciaItem = {
  provincia_id?: Id;
  provincia?: string;
  evento?: number;
  personas_fallecidas?: number;
  personas_heridas?: number;
  personas_afectadas?: number;
  familias_afectadas?: number;
  viviendas_afectadas?: number;
  viviendas_destruidas?: number;
  recintos_electorales_afectados?: number;
  recintos_electorales_destruidos?: number;
  bien_publico_afectado?: number;
  bien_publico_destruido?: number;
  bien_privado_afectado?: number;
  bien_privado_destruido?: number;
  puentes_afectados?: number;
  puentes_destruidos?: number;
  vias_primer_orden?: number;
  vias_segundo_orden?: number;
  vias_tercer_orden?: number;
  metros_lineales_vias_afectadas?: number;
  hectareas_cultivos_afectados?: number;
  hectareas_cultivos_perdidos?: number;
  animales_afectados?: number;
  animales_muertos?: number;
  [key: string]: unknown;
};

const { RangePicker } = DatePicker;
const ECUADOR_CENTER: [number, number] = [-1.8312, -78.1834];

const eventPalette = [
  '#4f8ed8',
  '#00a6d6',
  '#f5536b',
  '#9b6bbe',
  '#d67a58',
  '#d95f99',
  '#6bc36b',
  '#8dd7e8',
  '#7bad3b',
  '#f2b447',
];

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = payload as Record<string, unknown>;
  const candidate = record?.data || record?.items || record?.rows || record?.result || record?.registros || record?.detalle || record?.detalles;
  if (Array.isArray(candidate)) return candidate as T[];
  return record && typeof record === 'object' && Object.keys(record).length ? [record as T] : [];
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

function textOf(value: unknown) {
  return String(value || '').trim();
}

function catalogId(item: CatalogItem) {
  return item.id || item.provincia_id || item.canton_id || item.parroquia_id || item.evento_tipo_id || item.evento_estado_id;
}

function catalogName(item: CatalogItem) {
  return textOf(item.nombre || item.descripcion || catalogId(item));
}

function catalogOptions(items: CatalogItem[]) {
  const seen = new Set<string>();
  return items
    .map((item) => ({ value: catalogId(item), label: catalogName(item) }))
    .filter((option): option is { value: Id; label: string } => option.value !== undefined && option.value !== null && option.value !== '' && Boolean(option.label))
    .filter((option) => {
      const key = `${option.value}-${option.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function matchesCatalogFilter(filterValue: FilterValue, itemId: unknown, itemLabel: string, options: Array<{ value: Id; label: string }>) {
  if (filterValue === undefined || filterValue === null || filterValue === '') return true;
  if (String(itemId ?? '') === String(filterValue)) return true;
  const selected = options.find((option) => String(option.value) === String(filterValue));
  return selected ? normalizeText(selected.label) === normalizeText(itemLabel) : false;
}

function eventId(item: EventoItem) {
  return item.id || item.evento_id || '';
}

function dateValueOf(item: EventoItem) {
  return item.evento_fecha || item.fecha_evento || item.creacion || '';
}

function dateOf(item: EventoItem) {
  const value = dateValueOf(item);
  const parsed = value ? dayjs(String(value)) : null;
  return parsed?.isValid() ? parsed : null;
}

function provinciaOf(item: EventoItem) {
  return textOf(item.provincia_nombre || item.provincia);
}

function cantonOf(item: EventoItem) {
  return textOf(item.canton_nombre || item.canton);
}

function parroquiaOf(item: EventoItem) {
  return textOf(item.parroquia_nombre || item.parroquia);
}

function recintoOf(item: EventoItem) {
  return textOf(item.infraestructura_nombre || item.infraestructura || item.infraestructura_id);
}

function tipoEventoOf(item: EventoItem) {
  return textOf(item.evento_tipo_nombre || item.tipo || 'Sin evento');
}

function estadoOf(item: EventoItem) {
  return textOf(
    item.evento_atencion_estado_nombre
    || item.atencion_estado_nombre
    || item.evento_atencion_estado
    || item.atencion_estado
    || item.evento_estado_nombre
    || item.estado_nombre
    || item.evento_estado
    || item.estado
    || 'Sin estado',
  );
}

function descripcionOf(item: EventoItem) {
  return textOf(item.descripcion || item.observacion);
}

function numberValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function compareText(left: unknown, right: unknown) {
  return textOf(left).localeCompare(textOf(right), 'es', { numeric: true, sensitivity: 'base' });
}

function compareNumber(left: unknown, right: unknown) {
  return (numberValue(left) || 0) - (numberValue(right) || 0);
}

function affectationNumberColumn(title: string, dataIndex: string): ColumnsType<AfectacionesProvinciaItem>[number] {
  return {
    title,
    dataIndex,
    align: 'right',
    sorter: (left, right) => compareNumber(left[dataIndex], right[dataIndex]),
    onCell: (item) => ({
      className: (numberValue(item[dataIndex]) || 0) > 0 ? 'dashboard-value-cell' : '',
    }),
  };
}

function coordinatesOf(item: EventoItem): [number, number] | null {
  const lat = numberValue(item.latitud);
  const lng = numberValue(item.longitud);
  if (lat === undefined || lng === undefined) return null;
  if (lat < -5.5 || lat > 2.5 || lng < -92 || lng > -74) return null;
  return [lat, lng];
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function countBy<T>(items: T[], labelOf: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const label = labelOf(item) || 'Sin dato';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts, ([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value);
}

function sumBy<T>(items: T[], valueOf: (item: T) => unknown) {
  return items.reduce((sum, item) => sum + (numberValue(valueOf(item)) || 0), 0);
}

function statusStyle(value: string) {
  const status = normalizeText(value);
  if (status.includes('iniciada')) return { color: '#0958d9', background: '#e6f4ff', border: '#69b1ff', map: '#1677ff' };
  if (status.includes('media') || status.includes('proceso')) return { color: '#c2410c', background: '#fff7e6', border: '#ffa940', map: '#fa8c16' };
  if (status.includes('finalizada') || status.includes('final')) return { color: '#237804', background: '#f6ffed', border: '#73d13d', map: '#16a34a' };
  if (status.includes('suspendida')) return { color: '#a8071a', background: '#fff1f0', border: '#ff7875', map: '#f5222d' };
  if (status.includes('permanente')) return { color: '#531dab', background: '#f9f0ff', border: '#b37feb', map: '#722ed1' };
  return { color: '#455560', background: '#f5f7fa', border: '#b8c2cc', map: '#64748b' };
}

function StatusTag({ value }: { value: string }) {
  const style = statusStyle(value);
  return (
    <Tag
      style={{
        color: style.color,
        backgroundColor: style.background,
        borderColor: style.border,
        fontWeight: 800,
        margin: 0,
      }}
    >
      {value}
    </Tag>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="dashboard-section-title">
      <span>{children}</span>
    </div>
  );
}

function AffectationMetric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'warning' | 'success' | 'purple';
}) {
  return (
    <span className={`affectations-metric affectations-metric--${tone}`}>
      <i aria-hidden="true"><Icon size={34} strokeWidth={2.4} /></i>
      <b>{label}</b>
      <strong>{value}</strong>
    </span>
  );
}

function FitMapBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) {
      map.setView(ECUADOR_CENTER, 6);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
  }, [map, points]);
  return null;
}

function VerticalBars({ data }: { data: ChartDatum[] }) {
  const visibleData = data.slice(0, 18);
  const maxValue = Math.max(1, ...visibleData.map((item) => item.value));
  if (!visibleData.length) return <div className="dashboard-empty">Sin datos para graficar.</div>;
  return (
    <div className="dashboard-vbar-chart">
      {visibleData.map((item) => (
        <div className="dashboard-vbar" key={item.label}>
          <span>{item.value}</span>
          <div style={{ height: `${Math.max(8, (item.value / maxValue) * 170)}px` }} />
          <strong title={item.label}>{item.label}</strong>
        </div>
      ))}
    </div>
  );
}

function StackedBars({ data }: { data: StackedDatum[] }) {
  const visibleData = data.slice(0, 24);
  const maxValue = Math.max(1, ...visibleData.map((item) => item.total));
  if (!visibleData.length) return <div className="dashboard-empty">Sin datos para graficar.</div>;
  return (
    <div className="dashboard-stacked-chart">
      {visibleData.map((item) => (
        <div className="dashboard-stacked-row" key={item.label}>
          <strong>{item.label}</strong>
          <div className="dashboard-stacked-track">
            {item.segments.filter((segment) => segment.value > 0).map((segment) => (
              <span
                key={segment.label}
                title={`${segment.label}: ${segment.value}`}
                style={{
                  width: `${Math.max(2, (segment.value / maxValue) * 100)}%`,
                  backgroundColor: segment.color,
                }}
              >
                {segment.value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeDashboard() {
  const { authFetch, datosLogin, loginResponse } = useAuth();
  const [activeView, setActiveView] = useState<DashboardView>('eventos');
  const [items, setItems] = useState<EventoItem[]>([]);
  const [afectaciones, setAfectaciones] = useState<AfectacionesProvinciaItem[]>([]);
  const [provinces, setProvinces] = useState<CatalogItem[]>([]);
  const [cantons, setCantons] = useState<CatalogItem[]>([]);
  const [parishes, setParishes] = useState<CatalogItem[]>([]);
  const [eventTypes, setEventTypes] = useState<CatalogItem[]>([]);
  const [eventStates, setEventStates] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventPeriod, setEventPeriod] = useState<[Dayjs, Dayjs] | null>(null);
  const [eventProvince, setEventProvince] = useState<FilterValue>();
  const [eventCanton, setEventCanton] = useState<FilterValue>();
  const [parish, setParish] = useState<FilterValue>();
  const [eventType, setEventType] = useState<FilterValue>();
  const [status, setStatus] = useState<FilterValue>();
  const [affectationPeriod, setAffectationPeriod] = useState<[Dayjs, Dayjs] | null>(null);
  const [affectationProvince, setAffectationProvince] = useState<FilterValue>();
  const [affectationCanton, setAffectationCanton] = useState<FilterValue>();

  const institucionId = Number(datosLogin?.institucion_id || loginResponse?.usuario?.institucion_id || 0);

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
      if (!response.ok) throw new Error('No se pudieron cargar los eventos para el dashboard');
      setItems(unwrapArray<EventoItem>(await readJson<unknown>(response)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los eventos para el dashboard');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const loadAfectaciones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (affectationPeriod) {
        params.set('fecha_inicio', affectationPeriod[0].format('YYYY-MM-DD'));
        params.set('fecha_fin', affectationPeriod[1].format('YYYY-MM-DD'));
      }
      if (affectationProvince !== undefined) params.set('provincia_id', String(affectationProvince));
      if (affectationCanton !== undefined) params.set('canton_id', String(affectationCanton));
      const query = params.toString();
      const response = await authFetch(`${API_BASE_URL}/eventos/afectaciones/provincias${query ? `?${query}` : ''}`);
      if (!response.ok) throw new Error('No se pudieron cargar las afectaciones por provincia');
      setAfectaciones(unwrapArray<AfectacionesProvinciaItem>(await readJson<unknown>(response)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las afectaciones por provincia');
      setAfectaciones([]);
    } finally {
      setLoading(false);
    }
  }, [affectationCanton, affectationPeriod, affectationProvince, authFetch]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadAfectaciones();
  }, [loadAfectaciones]);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboardCatalogs() {
      try {
        const [provinceData, eventTypeData, eventStateData] = await Promise.all([
          loadCatalog<CatalogItem>('/provincias'),
          loadCatalog<CatalogItem>(`/evento-tipos/institucion/${institucionId}`),
          loadCatalog<CatalogItem>('/evento-atencion-estados'),
        ]);
        if (cancelled) return;
        setProvinces(provinceData);
        setEventTypes(eventTypeData);
        setEventStates(eventStateData);

        const cantonData = await loadCatalog<CatalogItem>('/cantones').catch(async () => (
          (await Promise.all(provinceData.map((provinceItem) => {
            const id = catalogId(provinceItem);
            return id ? loadCatalog<CatalogItem>(`/cantones/provincia/${id}`).catch(() => []) : Promise.resolve([]);
          }))).flat()
        ));
        if (cancelled) return;
        setCantons(cantonData);

        const parishData = await loadCatalog<CatalogItem>('/parroquias').catch(async () => (
          (await Promise.all(cantonData.map((cantonItem) => {
            const id = catalogId(cantonItem);
            return id ? loadCatalog<CatalogItem>(`/parroquias/canton/${id}`).catch(() => []) : Promise.resolve([]);
          }))).flat()
        ));
        if (!cancelled) setParishes(parishData);
      } catch {
        if (!cancelled) setError('No se pudieron cargar todos los catalogos del dashboard');
      }
    }
    void loadDashboardCatalogs();
    return () => {
      cancelled = true;
    };
  }, [institucionId, loadCatalog]);

  const provinceOptions = useMemo(() => catalogOptions(provinces), [provinces]);
  const cantonOptions = useMemo(() => catalogOptions(cantons), [cantons]);
  const parishOptions = useMemo(() => catalogOptions(parishes), [parishes]);
  const eventOptions = useMemo(() => catalogOptions(eventTypes), [eventTypes]);
  const statusOptions = useMemo(() => catalogOptions(eventStates), [eventStates]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const itemDate = dateOf(item);
    if (eventPeriod && (!itemDate || itemDate.isBefore(eventPeriod[0].startOf('day')) || itemDate.isAfter(eventPeriod[1].endOf('day')))) return false;
    if (!matchesCatalogFilter(eventProvince, item.provincia_id, provinciaOf(item), provinceOptions)) return false;
    if (!matchesCatalogFilter(eventCanton, item.canton_id, cantonOf(item), cantonOptions)) return false;
    if (!matchesCatalogFilter(parish, item.parroquia_id, parroquiaOf(item), parishOptions)) return false;
    if (!matchesCatalogFilter(eventType, item.evento_tipo_id ?? item.tipo_id, tipoEventoOf(item), eventOptions)) return false;
    if (!matchesCatalogFilter(status, item.evento_atencion_estado_id ?? item.atencion_estado_id ?? item.evento_estado_id ?? item.estado_id, estadoOf(item), statusOptions)) return false;
    return true;
  }), [cantonOptions, eventCanton, eventOptions, eventPeriod, eventProvince, eventType, items, parish, parishOptions, provinceOptions, status, statusOptions]);

  const filteredAfectaciones = useMemo(() => afectaciones.filter((item) => (
    matchesCatalogFilter(affectationProvince, item.provincia_id, textOf(item.provincia), provinceOptions)
  )), [afectaciones, affectationProvince, provinceOptions]);

  const afectacionesTotals = useMemo(() => ({
    evento: sumBy(filteredAfectaciones, (item) => item.evento),
    personas_fallecidas: sumBy(filteredAfectaciones, (item) => item.personas_fallecidas),
    personas_heridas: sumBy(filteredAfectaciones, (item) => item.personas_heridas),
    personas_afectadas: sumBy(filteredAfectaciones, (item) => item.personas_afectadas),
    familias_afectadas: sumBy(filteredAfectaciones, (item) => item.familias_afectadas),
    viviendas_afectadas: sumBy(filteredAfectaciones, (item) => item.viviendas_afectadas),
    viviendas_destruidas: sumBy(filteredAfectaciones, (item) => item.viviendas_destruidas),
    recintos_electorales_afectados: sumBy(filteredAfectaciones, (item) => item.recintos_electorales_afectados),
    recintos_electorales_destruidos: sumBy(filteredAfectaciones, (item) => item.recintos_electorales_destruidos),
    bien_publico_afectado: sumBy(filteredAfectaciones, (item) => item.bien_publico_afectado),
    bien_publico_destruido: sumBy(filteredAfectaciones, (item) => item.bien_publico_destruido),
    bien_privado_afectado: sumBy(filteredAfectaciones, (item) => item.bien_privado_afectado),
    bien_privado_destruido: sumBy(filteredAfectaciones, (item) => item.bien_privado_destruido),
    puentes_afectados: sumBy(filteredAfectaciones, (item) => item.puentes_afectados),
    puentes_destruidos: sumBy(filteredAfectaciones, (item) => item.puentes_destruidos),
    vias_primer_orden: sumBy(filteredAfectaciones, (item) => item.vias_primer_orden),
    vias_segundo_orden: sumBy(filteredAfectaciones, (item) => item.vias_segundo_orden),
    vias_tercer_orden: sumBy(filteredAfectaciones, (item) => item.vias_tercer_orden),
    metros_lineales_vias_afectadas: sumBy(filteredAfectaciones, (item) => item.metros_lineales_vias_afectadas),
    hectareas_cultivos_afectados: sumBy(filteredAfectaciones, (item) => item.hectareas_cultivos_afectados),
    hectareas_cultivos_perdidos: sumBy(filteredAfectaciones, (item) => item.hectareas_cultivos_perdidos),
    animales_afectados: sumBy(filteredAfectaciones, (item) => item.animales_afectados),
    animales_muertos: sumBy(filteredAfectaciones, (item) => item.animales_muertos),
  }), [filteredAfectaciones]);

  const statusCounts = useMemo(() => countBy(filteredItems, estadoOf), [filteredItems]);
  const statusSummary = useMemo(() => {
    const counts = new Map(statusCounts.map((item) => [normalizeText(item.label), item.value]));
    return statusOptions.map((option) => ({
      label: option.label,
      value: counts.get(normalizeText(option.label)) || 0,
    }));
  }, [statusCounts, statusOptions]);
  const eventCounts = useMemo(() => countBy(filteredItems, tipoEventoOf), [filteredItems]);
  const provinceStacked = useMemo<StackedDatum[]>(() => {
    const events = eventCounts.slice(0, 9).map((item) => item.label);
    const fallbackLabel = 'Otros';
    const provinceMap = new Map<string, Map<string, number>>();
    const provinceLabels = provinceOptions.map((option) => option.label);
    filteredItems.forEach((item) => {
      const matchedProvince = provinceOptions.find((option) => String(option.value) === String(item.provincia_id));
      const provinceName = matchedProvince?.label || provinciaOf(item) || 'Sin provincia';
      const eventName = events.includes(tipoEventoOf(item)) ? tipoEventoOf(item) : fallbackLabel;
      if (!provinceMap.has(provinceName)) provinceMap.set(provinceName, new Map());
      const eventMap = provinceMap.get(provinceName)!;
      eventMap.set(eventName, (eventMap.get(eventName) || 0) + 1);
    });
    const labels = [...events, fallbackLabel];
    return uniqueOptions([...provinceLabels, ...Array.from(provinceMap.keys())]).map((label) => {
      const values = provinceMap.get(label) || new Map<string, number>();
      return {
        label,
        total: Array.from(values.values()).reduce((sum, value) => sum + value, 0),
        segments: labels.map((segmentLabel, index) => ({
          label: segmentLabel,
          value: values.get(segmentLabel) || 0,
          color: eventPalette[index % eventPalette.length],
        })),
      };
    });
  }, [eventCounts, filteredItems, provinceOptions]);

  const provinceStackedSorted = useMemo(() => [...provinceStacked].sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total;
    return left.label.localeCompare(right.label);
  }), [provinceStacked]);

  const provinceStackedForChart = provinceStackedSorted.length ? provinceStackedSorted : provinceStacked;

  const mappedItems = useMemo(() => filteredItems
    .map((item) => ({ item, coordinates: coordinatesOf(item) }))
    .filter((entry): entry is { item: EventoItem; coordinates: [number, number] } => entry.coordinates !== null), [filteredItems]);

  const tableColumns = useMemo<ColumnsType<EventoItem>>(() => [
    { title: '#', width: 54, sorter: (left, right) => compareText(eventId(left), eventId(right)), render: (_value, _item, index) => index + 1 },
    { title: 'Provincia', sorter: (left, right) => compareText(provinciaOf(left), provinciaOf(right)), render: (_value, item) => provinciaOf(item) },
    { title: 'Canton', sorter: (left, right) => compareText(cantonOf(left), cantonOf(right)), render: (_value, item) => cantonOf(item) },
    { title: 'Parroquia', sorter: (left, right) => compareText(parroquiaOf(left), parroquiaOf(right)), render: (_value, item) => parroquiaOf(item) },
    { title: 'Recinto', sorter: (left, right) => compareText(recintoOf(left), recintoOf(right)), render: (_value, item) => recintoOf(item) },
    { title: 'Sector', dataIndex: 'sector', sorter: (left, right) => compareText(left.sector, right.sector) },
    { title: 'Evento', sorter: (left, right) => compareText(tipoEventoOf(left), tipoEventoOf(right)), render: (_value, item) => tipoEventoOf(item) },
    { title: 'Fecha del Evento', sorter: (left, right) => (dateOf(left)?.valueOf() || 0) - (dateOf(right)?.valueOf() || 0), render: (_value, item) => dateOf(item)?.format('DD/MM/YYYY') || '' },
    { title: 'Estado', sorter: (left, right) => compareText(estadoOf(left), estadoOf(right)), render: (_value, item) => <StatusTag value={estadoOf(item)} /> },
    { title: 'Descripcion general del Evento', sorter: (left, right) => compareText(descripcionOf(left), descripcionOf(right)), render: (_value, item) => descripcionOf(item) },
  ], []);

  const afectacionesColumns = useMemo<ColumnsType<AfectacionesProvinciaItem>>(() => [
    { title: '#', width: 54, sorter: (left, right) => compareText(left.provincia_id, right.provincia_id), render: (_value, _item, index) => index + 1 },
    { title: 'Provincia', dataIndex: 'provincia', sorter: (left, right) => compareText(left.provincia, right.provincia) },
    affectationNumberColumn('Evento', 'evento'),
    affectationNumberColumn('Personas Fallecidas', 'personas_fallecidas'),
    affectationNumberColumn('Personas Heridas', 'personas_heridas'),
    affectationNumberColumn('Personas Afectadas', 'personas_afectadas'),
    affectationNumberColumn('Familias Afectadas', 'familias_afectadas'),
    affectationNumberColumn('Viviendas Afectadas', 'viviendas_afectadas'),
    affectationNumberColumn('Viviendas Destruidas', 'viviendas_destruidas'),
    affectationNumberColumn('Recintos Electorales Afectados', 'recintos_electorales_afectados'),
    affectationNumberColumn('Recintos Electorales Destruidos', 'recintos_electorales_destruidos'),
    affectationNumberColumn('Bien Publico Afectado', 'bien_publico_afectado'),
    affectationNumberColumn('Bien Publico Destruido', 'bien_publico_destruido'),
    affectationNumberColumn('Bien Privado Afectado', 'bien_privado_afectado'),
    affectationNumberColumn('Bien Privado Destruido', 'bien_privado_destruido'),
    affectationNumberColumn('Puentes Afectados', 'puentes_afectados'),
    affectationNumberColumn('Puentes Destruidos', 'puentes_destruidos'),
    affectationNumberColumn('Vias de Primer Orden (m)', 'vias_primer_orden'),
    affectationNumberColumn('Vias de Segundo Orden (m)', 'vias_segundo_orden'),
    affectationNumberColumn('Vias de Tercer Orden (m)', 'vias_tercer_orden'),
    affectationNumberColumn('Metros Lineales de Vias Afectadas', 'metros_lineales_vias_afectadas'),
    affectationNumberColumn('Ha Cultivos Afectados', 'hectareas_cultivos_afectados'),
    affectationNumberColumn('Ha Cultivos Perdidos', 'hectareas_cultivos_perdidos'),
    affectationNumberColumn('Animales Afectados', 'animales_afectados'),
    affectationNumberColumn('Animales Muertos', 'animales_muertos'),
  ], []);

  const eventLegend = provinceStackedForChart
    .flatMap((item) => item.segments)
    .filter((segment, index, segments) => segment.value > 0 && segments.findIndex((candidate) => candidate.label === segment.label) === index);

  const totalViasAfectadas = afectacionesTotals.vias_primer_orden
    + afectacionesTotals.vias_segundo_orden
    + afectacionesTotals.vias_tercer_orden
    || afectacionesTotals.metros_lineales_vias_afectadas;

  const activePeriod = activeView === 'eventos' ? eventPeriod : affectationPeriod;
  const activeProvince = activeView === 'eventos' ? eventProvince : affectationProvince;
  const activeCanton = activeView === 'eventos' ? eventCanton : affectationCanton;

  function changePeriod(value: [Dayjs, Dayjs] | null) {
    if (activeView === 'eventos') setEventPeriod(value);
    else setAffectationPeriod(value);
  }

  function changeProvince(value: FilterValue) {
    if (activeView === 'eventos') setEventProvince(value);
    else setAffectationProvince(value);
  }

  function changeCanton(value: FilterValue) {
    if (activeView === 'eventos') setEventCanton(value);
    else setAffectationCanton(value);
  }

  function clearFilters() {
    if (activeView === 'eventos') {
      setEventPeriod(null);
      setEventProvince(undefined);
      setEventCanton(undefined);
      setParish(undefined);
      setEventType(undefined);
      setStatus(undefined);
    } else {
      setAffectationPeriod(null);
      setAffectationProvince(undefined);
      setAffectationCanton(undefined);
    }
  }

  return (
    <div className="home-dashboard home-dashboard--native">
      {error ? <Alert className="mb-3" type="warning" showIcon message={error} /> : null}
      <Spin spinning={loading}>
        <div className="dashboard-report">
          <div className="dashboard-view-tabs">
            <button type="button" className={activeView === 'eventos' ? 'is-active' : ''} onClick={() => setActiveView('eventos')}>
              Eventos adversos
            </button>
            <button type="button" className={activeView === 'afectaciones' ? 'is-active' : ''} onClick={() => setActiveView('afectaciones')}>
              Resumen de afectaciones
            </button>
          </div>

          <div className="dashboard-filter-shell">
            <div className="dashboard-filter-shell__header">
              <div>
                <span className="dashboard-eyebrow">Visor Gestion electoral</span>
              </div>
              <Button onClick={clearFilters}>Limpiar filtros</Button>
            </div>
            <div className="dashboard-filters">
              <label>
                <strong>Seleccione Periodo</strong>
                <RangePicker
                  allowClear
                  className="dashboard-filter dashboard-filter--period"
                  format="DD/MM/YYYY"
                  value={activePeriod}
                  onChange={(value) => changePeriod(value?.[0] && value[1] ? [value[0], value[1]] : null)}
                />
              </label>
              <label>
                <strong>Seleccione Provincia</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--province"
                  placeholder="Provincia"
                  value={activeProvince}
                  optionFilterProp="label"
                  options={provinceOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={changeProvince}
                />
              </label>
              <label>
                <strong>Seleccione Canton</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--canton"
                  placeholder="Canton"
                  value={activeCanton}
                  optionFilterProp="label"
                  options={cantonOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={changeCanton}
                />
              </label>
              {activeView === 'eventos' ? <label>
                <strong>Seleccione Parroquia</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--parish"
                  placeholder="Parroquia"
                  value={parish}
                  optionFilterProp="label"
                  options={parishOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={setParish}
                />
              </label> : null}
              {activeView === 'eventos' ? <label>
                <strong>Evento</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--event"
                  placeholder="Evento"
                  value={eventType}
                  optionFilterProp="label"
                  options={eventOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={setEventType}
                />
              </label> : null}
              {activeView === 'eventos' ? <label>
                <strong>Estado de Atencion</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--status"
                  placeholder="Estado de Atencion"
                  value={status}
                  optionFilterProp="label"
                  options={statusOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={setStatus}
                />
              </label> : null}
            </div>
          </div>

          {activeView === 'eventos' ? <div className="dashboard-layout">
            <div className="dashboard-left">
              <div className="dashboard-status-summary">
                <div className="dashboard-total-card">
                  <span>Total de eventos</span>
                  <strong>{filteredItems.length}</strong>
                </div>
                <div className="dashboard-status-cards">
                  {statusSummary.length ? statusSummary.map((item) => {
                    const style = statusStyle(item.label);
                    return (
                      <div className="dashboard-status-card" key={item.label}>
                        <span style={{ color: style.map }}>{item.label}</span>
                        <strong style={{ color: style.map }}>{item.value}</strong>
                      </div>
                    );
                  }) : <div className="dashboard-status-card"><span>Sin estado</span><strong>0</strong></div>}
                </div>
              </div>

              <section className="dashboard-panel">
                <SectionTitle>Eventos por tipo</SectionTitle>
                <VerticalBars data={eventCounts} />
              </section>

              <section className="dashboard-panel">
                <SectionTitle>Eventos por provincia</SectionTitle>
                <div className="dashboard-legend">
                  {eventLegend.map((item) => (
                    <span key={item.label}><i style={{ backgroundColor: item.color }} />{item.label}</span>
                  ))}
                </div>
                <StackedBars data={provinceStackedForChart} />
              </section>
            </div>

            <div className="dashboard-right">
              <section className="dashboard-map-panel">
                <SectionTitle>Mapa de eventos por estado de atencion</SectionTitle>
                <MapContainer center={ECUADOR_CENTER} zoom={6} scrollWheelZoom className="dashboard-map">
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitMapBounds points={mappedItems.map((entry) => entry.coordinates)} />
                  {mappedItems.map(({ item, coordinates }) => {
                    const markerStyle = statusStyle(estadoOf(item));
                    return (
                      <CircleMarker
                        key={`${eventId(item)}-${coordinates[0]}-${coordinates[1]}`}
                        center={coordinates}
                        radius={6}
                        pathOptions={{ color: markerStyle.map, fillColor: markerStyle.map, fillOpacity: 0.72, weight: 2 }}
                      >
                        <Popup>
                          <strong>{tipoEventoOf(item)}</strong>
                          <br />
                          {recintoOf(item) || textOf(item.sector) || 'Sin recinto'}
                          <br />
                          <StatusTag value={estadoOf(item)} />
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
                <div className="dashboard-map-legend">
                  <strong>Estado de Atencion</strong>
                  {statusCounts.map((item) => <span key={item.label}><i style={{ backgroundColor: statusStyle(item.label).map }} />{item.label}</span>)}
                </div>
              </section>
            </div>
          </div> : (
            <div className="affectations-dashboard">
              <section className="affectations-summary-grid">
                <div className="affectations-card affectations-card--people">
                  <SectionTitle>Afectacion a las personas</SectionTitle>
                  <div className="affectations-metrics affectations-metrics--two">
                    <AffectationMetric icon={UserX} label="Personas fallecidas" value={afectacionesTotals.personas_fallecidas} tone="danger" />
                    <AffectationMetric icon={HeartPulse} label="Personas heridas" value={afectacionesTotals.personas_heridas} tone="warning" />
                    <AffectationMetric icon={Users} label="Personas afectadas" value={afectacionesTotals.personas_afectadas} />
                    <AffectationMetric icon={UsersRound} label="Familias afectadas" value={afectacionesTotals.familias_afectadas} />
                  </div>
                </div>
                <div className="affectations-card affectations-card--infra">
                  <SectionTitle>Afectaciones en infraestructura</SectionTitle>
                  <div className="affectations-metrics">
                    <AffectationMetric icon={Home} label="Viviendas afectadas" value={afectacionesTotals.viviendas_afectadas} />
                    <AffectationMetric icon={TriangleAlert} label="Viviendas destruidas" value={afectacionesTotals.viviendas_destruidas} tone="danger" />
                    <AffectationMetric icon={Vote} label="Recintos electorales afectados" value={afectacionesTotals.recintos_electorales_afectados} tone="purple" />
                    <AffectationMetric icon={OctagonX} label="Recintos electorales destruidos" value={afectacionesTotals.recintos_electorales_destruidos} tone="danger" />
                    <AffectationMetric icon={Landmark} label="Bien publico afectado" value={afectacionesTotals.bien_publico_afectado} />
                    <AffectationMetric icon={Ban} label="Bien publico destruido" value={afectacionesTotals.bien_publico_destruido} tone="danger" />
                    <AffectationMetric icon={Building2} label="Bien privado afectado" value={afectacionesTotals.bien_privado_afectado} />
                    <AffectationMetric icon={Warehouse} label="Bien privado destruido" value={afectacionesTotals.bien_privado_destruido} tone="danger" />
                    <AffectationMetric icon={Bridge} label="Puentes afectados" value={afectacionesTotals.puentes_afectados} tone="warning" />
                    <AffectationMetric icon={Ban} label="Puentes destruidos" value={afectacionesTotals.puentes_destruidos} tone="danger" />
                    <AffectationMetric icon={Route} label="Vias primer orden (m)" value={afectacionesTotals.vias_primer_orden} tone="success" />
                    <AffectationMetric icon={Route} label="Vias segundo orden (m)" value={afectacionesTotals.vias_segundo_orden} tone="success" />
                    <AffectationMetric icon={Route} label="Vias tercer orden (m)" value={afectacionesTotals.vias_tercer_orden} tone="success" />
                    <AffectationMetric icon={Route} label="Total vias afectadas (m)" value={totalViasAfectadas} tone="success" />
                  </div>
                </div>
                <div className="affectations-card affectations-card--coverage">
                  <SectionTitle>Cobertura vegetal y animales</SectionTitle>
                  <div className="affectations-metrics affectations-metrics--two">
                    <AffectationMetric icon={Wheat} label="Ha cultivos afectados" value={afectacionesTotals.hectareas_cultivos_afectados} tone="success" />
                    <AffectationMetric icon={Sprout} label="Ha cultivos perdidos" value={afectacionesTotals.hectareas_cultivos_perdidos} tone="warning" />
                    <AffectationMetric icon={PawPrint} label="Animales afectados" value={afectacionesTotals.animales_afectados} />
                    <AffectationMetric icon={OctagonX} label="Animales muertos" value={afectacionesTotals.animales_muertos} tone="danger" />
                  </div>
                </div>
                <div className="affectations-card affectations-card--events">
                  <SectionTitle>Eventos</SectionTitle>
                  <div className="affectations-big-number">
                    <Activity size={42} strokeWidth={2.4} aria-hidden="true" />
                    <span>Total eventos</span>
                    <strong>{afectacionesTotals.evento}</strong>
                  </div>
                </div>
              </section>

              <section className="dashboard-detail-table">
                <SectionTitle>Detalle de afectaciones por provincia</SectionTitle>
                <Table
                  rowKey={(item, index) => String(item.provincia_id || item.provincia || index)}
                  columns={afectacionesColumns}
                  dataSource={filteredAfectaciones}
                  pagination={{ pageSize: 12, showSizeChanger: false }}
                  size="small"
                  scroll={{ x: 2600 }}
                />
              </section>
            </div>
          )}

          {activeView === 'eventos' ? <section className="dashboard-detail-table">
            <SectionTitle>Detalle de eventos registrados</SectionTitle>
            <Table
              rowKey={(item, index) => String(eventId(item) || index)}
              columns={tableColumns}
              dataSource={filteredItems}
              pagination={{ pageSize: 12, showSizeChanger: false }}
              size="small"
              scroll={{ x: 1320 }}
            />
          </section> : null}
        </div>
      </Spin>
    </div>
  );
}
