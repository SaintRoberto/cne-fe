import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Select, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import L from 'leaflet';
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
    item.evento_estado_nombre
    || item.estado_nombre
    || item.evento_estado
    || item.estado
    || item.evento_atencion_estado_nombre
    || item.atencion_estado_nombre
    || item.evento_atencion_estado
    || item.atencion_estado
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
  const [items, setItems] = useState<EventoItem[]>([]);
  const [provinces, setProvinces] = useState<CatalogItem[]>([]);
  const [cantons, setCantons] = useState<CatalogItem[]>([]);
  const [parishes, setParishes] = useState<CatalogItem[]>([]);
  const [eventTypes, setEventTypes] = useState<CatalogItem[]>([]);
  const [eventStates, setEventStates] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<[Dayjs, Dayjs] | null>(null);
  const [province, setProvince] = useState<FilterValue>();
  const [canton, setCanton] = useState<FilterValue>();
  const [parish, setParish] = useState<FilterValue>();
  const [eventType, setEventType] = useState<FilterValue>();
  const [status, setStatus] = useState<FilterValue>();

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

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboardCatalogs() {
      try {
        const [provinceData, eventTypeData, eventStateData] = await Promise.all([
          loadCatalog<CatalogItem>('/provincias'),
          loadCatalog<CatalogItem>(`/evento-tipos/institucion/${institucionId}`),
          loadCatalog<CatalogItem>('/evento-estados'),
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
    if (period && (!itemDate || itemDate.isBefore(period[0].startOf('day')) || itemDate.isAfter(period[1].endOf('day')))) return false;
    if (!matchesCatalogFilter(province, item.provincia_id, provinciaOf(item), provinceOptions)) return false;
    if (!matchesCatalogFilter(canton, item.canton_id, cantonOf(item), cantonOptions)) return false;
    if (!matchesCatalogFilter(parish, item.parroquia_id, parroquiaOf(item), parishOptions)) return false;
    if (!matchesCatalogFilter(eventType, item.evento_tipo_id ?? item.tipo_id, tipoEventoOf(item), eventOptions)) return false;
    if (!matchesCatalogFilter(status, item.evento_estado_id ?? item.estado_id ?? item.evento_atencion_estado_id ?? item.atencion_estado_id, estadoOf(item), statusOptions)) return false;
    return true;
  }), [canton, cantonOptions, eventOptions, eventType, items, parish, parishOptions, period, province, provinceOptions, status, statusOptions]);

  const statusCounts = useMemo(() => countBy(filteredItems, estadoOf), [filteredItems]);
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
    { title: '#', width: 54, render: (_value, _item, index) => index + 1 },
    { title: 'Provincia', render: (_value, item) => provinciaOf(item) },
    { title: 'Canton', render: (_value, item) => cantonOf(item) },
    { title: 'Parroquia', render: (_value, item) => parroquiaOf(item) },
    { title: 'Recinto', render: (_value, item) => recintoOf(item) },
    { title: 'Sector', dataIndex: 'sector' },
    { title: 'Evento', render: (_value, item) => tipoEventoOf(item) },
    { title: 'Fecha del Evento', render: (_value, item) => dateOf(item)?.format('DD/MM/YYYY') || '' },
    { title: 'Estado', render: (_value, item) => <StatusTag value={estadoOf(item)} /> },
    { title: 'Descripcion general del Evento', render: (_value, item) => descripcionOf(item) },
  ], []);

  const eventLegend = provinceStackedForChart
    .flatMap((item) => item.segments)
    .filter((segment, index, segments) => segment.value > 0 && segments.findIndex((candidate) => candidate.label === segment.label) === index);

  function clearFilters() {
    setPeriod(null);
    setProvince(undefined);
    setCanton(undefined);
    setParish(undefined);
    setEventType(undefined);
    setStatus(undefined);
  }

  return (
    <div className="home-dashboard home-dashboard--native">
      {error ? <Alert className="mb-3" type="warning" showIcon message={error} /> : null}
      <Spin spinning={loading}>
        <div className="dashboard-report">
          

          <div className="dashboard-filter-shell">
            <div className="dashboard-filter-shell__header">
              <div>
                <span className="dashboard-eyebrow">Gestion electoral</span>
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
                  value={period}
                  onChange={(value) => setPeriod(value?.[0] && value[1] ? [value[0], value[1]] : null)}
                />
              </label>
              <label>
                <strong>Seleccione Provincia</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--province"
                  placeholder="Provincia"
                  value={province}
                  optionFilterProp="label"
                  options={provinceOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={(value) => {
                    setProvince(value);
                  }}
                />
              </label>
              <label>
                <strong>Seleccione Canton</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--canton"
                  placeholder="Canton"
                  value={canton}
                  optionFilterProp="label"
                  options={cantonOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={setCanton}
                />
              </label>
              <label>
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
              </label>
              <label>
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
              </label>
              <label>
                <strong>Estado del Evento</strong>
                <Select
                  allowClear
                  showSearch
                  className="dashboard-filter dashboard-filter--status"
                  placeholder="Estado del Evento"
                  value={status}
                  optionFilterProp="label"
                  options={statusOptions.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={setStatus}
                />
              </label>
            </div>
          </div>

          <div className="dashboard-layout">
            <div className="dashboard-left">
              <div className="dashboard-status-summary">
                <div className="dashboard-total-card">
                  <span>Total de eventos</span>
                  <strong>{filteredItems.length}</strong>
                </div>
                <div className="dashboard-status-cards">
                  {statusCounts.length ? statusCounts.map((item) => {
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
                <SectionTitle>Mapa de eventos por estado</SectionTitle>
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
                  <strong>Estado del Evento</strong>
                  {statusCounts.map((item) => <span key={item.label}><i style={{ backgroundColor: statusStyle(item.label).map }} />{item.label}</span>)}
                </div>
              </section>
            </div>
          </div>

          <section className="dashboard-detail-table">
            <SectionTitle>Detalle de eventos registrados</SectionTitle>
            <Table
              rowKey={(item, index) => String(eventId(item) || index)}
              columns={tableColumns}
              dataSource={filteredItems}
              pagination={{ pageSize: 12, showSizeChanger: false }}
              size="small"
              scroll={{ x: 1320 }}
            />
          </section>
        </div>
      </Spin>
    </div>
  );
}
