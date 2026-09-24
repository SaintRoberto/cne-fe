import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Space } from 'antd';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

type MapSelectorProps = {
  latitude?: number | null;
  longitude?: number | null;
  readonly?: boolean;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

const mapPinIcon = L.divIcon({
  className: 'map-selector__pin-icon',
  html: '<span class="map-selector__pin" aria-hidden="true"></span>',
  iconSize: [30, 42],
  iconAnchor: [15, 40],
});

function MapClickHandler({ readonly, onChange }: Pick<MapSelectorProps, 'readonly' | 'onChange'>) {
  useMapEvents({
    click(event) {
      if (!readonly) onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

export function MapSelector({ latitude, longitude, readonly = false, onChange }: MapSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const position = useMemo<[number, number]>(() => [
    Number(latitude || -1.05458),
    Number(longitude || -80.45445),
  ], [latitude, longitude]);

  useEffect(() => {
    setResults([]);
  }, [latitude, longitude]);

  async function searchPlace() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        countrycodes: 'ec',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      if (!response.ok) throw new Error('No se pudo buscar la direccion');
      setResults(await response.json() as NominatimResult[]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="map-selector">
      {!readonly ? (
        <Space.Compact className="map-selector__search">
          <Input
            value={query}
            placeholder="Buscar lugar o sector"
            onChange={(event) => setQuery(event.target.value)}
            onPressEnter={searchPlace}
          />
          <Button loading={searching} onClick={searchPlace}>Buscar</Button>
        </Space.Compact>
      ) : null}

      {results.length ? (
        <div className="map-selector__results">
          {results.map((result) => (
            <button
              key={`${result.lat}-${result.lon}`}
              type="button"
              onClick={() => onChange({ latitude: Number(result.lat), longitude: Number(result.lon) })}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      ) : null}

      <MapContainer center={position} zoom={12} scrollWheelZoom className="map-selector__map" key={`${position[0]}-${position[1]}`}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler readonly={readonly} onChange={onChange} />
        <Marker position={position} icon={mapPinIcon} />
      </MapContainer>
      <div className="map-selector__coords">
        Latitud: {position[0].toFixed(6)} · Longitud: {position[1].toFixed(6)}
      </div>
    </div>
  );
}
