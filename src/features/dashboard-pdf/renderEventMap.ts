import type { DashboardPdfEvent } from './exportDashboardToPdf';

type MapPoint = { latitude: number; longitude: number; status: string };

const STATUS_COLORS = ['#1677d2', '#00a6a6', '#f59e0b', '#e05666', '#7c5cc4', '#4f9d69'];

function text(value: unknown) {
  return String(value ?? '').trim();
}

function statusOf(event: DashboardPdfEvent) {
  return text(
    event.evento_atencion_estado_nombre || event.atencion_estado_nombre || event.evento_atencion_estado
    || event.atencion_estado || event.evento_estado_nombre || event.estado_nombre || event.estado || 'Sin estado',
  );
}

function pointsOf(events: DashboardPdfEvent[]) {
  return events.map((event): MapPoint | null => {
    const latitude = Number(event.latitud);
    const longitude = Number(event.longitud);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -5.5 || latitude > 2.5 || longitude < -92 || longitude > -74) return null;
    return { latitude, longitude, status: statusOf(event) };
  }).filter((point): point is MapPoint => point !== null);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function renderEventMap(events: DashboardPdfEvent[]) {
  const points = pointsOf(events);
  if (!points.length) return null;

  const [{ default: L }, { default: html2canvas }] = await Promise.all([
    import('leaflet'),
    import('html2canvas-pro'),
  ]);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:1040px;background:#e8eef4;z-index:-1;';
  document.body.appendChild(container);

  const map = L.map(container, { attributionControl: true, zoomControl: false, preferCanvas: true });
  try {
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: true,
      maxZoom: 18,
    });
    const tilesReady = new Promise<void>((resolve) => tileLayer.once('load', () => resolve()));
    tileLayer.addTo(map);

    const statuses = Array.from(new Set(points.map((point) => point.status)));
    const colorOf = (status: string) => STATUS_COLORS[Math.max(0, statuses.indexOf(status)) % STATUS_COLORS.length];
    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
    points.forEach((point) => {
      L.circleMarker([point.latitude, point.longitude], {
        radius: 7, color: '#ffffff', weight: 2, fillColor: colorOf(point.status), fillOpacity: 0.9,
      }).addTo(map);
    });
    map.fitBounds(bounds.pad(0.18), { animate: false, maxZoom: 11 });
    map.invalidateSize(false);

    const legend = document.createElement('div');
    legend.style.cssText = 'position:absolute;left:14px;bottom:28px;z-index:1000;max-width:420px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(15,23,42,.2);font:13px Arial;color:#24384b;';
    const legendTitle = document.createElement('strong');
    legendTitle.textContent = 'Estados';
    legendTitle.style.cssText = 'display:block;margin-bottom:6px;';
    legend.appendChild(legendTitle);
    statuses.slice(0, 8).forEach((status) => {
      const item = document.createElement('span');
      item.style.cssText = 'display:inline-flex;align-items:center;margin:3px 12px 3px 0;';
      const color = document.createElement('i');
      color.style.cssText = `width:10px;height:10px;margin-right:5px;border-radius:50%;background:${colorOf(status)};`;
      item.append(color, document.createTextNode(status));
      legend.appendChild(item);
    });
    container.appendChild(legend);

    await Promise.race([tilesReady, wait(3500)]);
    await wait(300);
    const canvas = await html2canvas(container, {
      backgroundColor: '#e8eef4', height: 1040, logging: false, scale: 1.1, useCORS: true, width: 1000,
    });
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    map.remove();
    container.remove();
  }
}
