import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { MapPin } from 'lucide-react';

// Ikon marker Leaflet bawaan rusak di bundler Vite — ganti dengan pin buatan:
const pinIcon = L.divIcon({
  className: 'gps-picker-pin',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50% 50% 50% 0;background:#dc2626;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"><span style="width:10px;height:10px;border-radius:50%;background:#fff;transform:rotate(45deg)"></span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const JEMBER_CENTER: [number, number] = [-8.172, 113.7];

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function GpsMapPicker({
  latitude,
  longitude,
  onSelect,
}: {
  latitude: string;
  longitude: string;
  onSelect: (lat: number, lng: number) => void;
}) {
  const parsedLat = Number(latitude);
  const parsedLng = Number(longitude);
  const center = useMemo<[number, number]>(() => {
    if (Number.isFinite(parsedLat) && parsedLat !== 0 && Number.isFinite(parsedLng) && parsedLng !== 0) {
      return [parsedLat, parsedLng];
    }
    return JEMBER_CENTER;
  }, [parsedLat, parsedLng]);

  const hasPoint = Number.isFinite(parsedLat) && parsedLat !== 0 && Number.isFinite(parsedLng) && parsedLng !== 0;

  return (
    <div className="relative z-0 isolate overflow-hidden rounded-md border border-garis">
      <MapContainer center={center} zoom={hasPoint ? 15 : 10} scrollWheelZoom={false} className="h-[280px] w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ClickHandler onSelect={onSelect} />
        {hasPoint && <Marker position={center} icon={pinIcon} />}
      </MapContainer>
      <p className="flex items-center gap-1.5 border-t border-garis bg-panel2 px-3 py-2 text-[11px] text-tinta2">
        <MapPin size={12} aria-hidden="true" />
        Klik pada peta untuk menempatkan titik laporan. Marker merah mengikuti klik Anda.
      </p>
    </div>
  );
}
