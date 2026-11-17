import type { Feature, Geometry } from 'geojson';
import L from 'leaflet';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { REPORT_TYPE_LABEL, type Report, type ReportType } from '../lib/types';

const TYPE_COLOR: Record<ReportType, string> = {
  pest: '#16A34A',
  irrigation: '#2563EB',
  fertilizer: '#7C3AED',
  harvest: '#65A30D',
  weather: '#0EA5E9',
  equipment: '#78716C',
};

const JEMBER_CENTER: [number, number] = [-8.172, 113.7];

export interface PestClusterFeatureProps {
  cluster_id: string;
  opt_id: number;
  opt_name: string;
  point_count: number;
  total_affected_ha: number;
  buffer_radius_m: number;
  days: number;
}

export interface PestClusterCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: PestClusterFeatureProps;
    geometry: Geometry | null;
  }>;
  meta?: {
    days: number;
    cluster_count: number;
    total_points: number;
  };
}

export function ClusterLayer({ clusters }: { clusters: PestClusterCollection }) {
  const style: L.StyleFunction = () => ({
    color: '#ea580c',
    weight: 2,
    opacity: 0.9,
    fillColor: '#f97316',
    fillOpacity: 0.22,
  });

  const onEachFeature = (feature: Feature<Geometry, PestClusterFeatureProps>, layer: L.Layer) => {
    const p = feature.properties;
    layer.bindPopup(
      `Potensi Outbreak: ${p.opt_name} - ${p.point_count} titik laporan dalam ${p.days} hari terakhir (Total ${p.total_affected_ha.toLocaleString('id-ID')} ha)`,
    );
  };

  return (
    <GeoJSON
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data={clusters as any}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

export function MapView({
  reports,
  clusters,
  showClusters = false,
  heightClass = 'h-[380px] sm:h-[420px]',
}: {
  reports: Report[];
  clusters?: PestClusterCollection | null;
  showClusters?: boolean;
  heightClass?: string;
}) {
  const points = reports.filter((r) => r.latitude != null && r.longitude != null);

  return (
    <div className={`relative z-0 isolate w-full overflow-hidden rounded-md border border-garis ${heightClass}`}>
      <MapContainer
        center={JEMBER_CENTER}
        zoom={10}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {points.map((report) => (
          <CircleMarker
            key={report.id}
            center={[Number(report.latitude), Number(report.longitude)]}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: TYPE_COLOR[report.report_type],
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="text-xs leading-5 space-y-1">
                <p className="font-mono font-semibold">{report.report_number ?? 'Draf'}</p>
                <p>{REPORT_TYPE_LABEL[report.report_type]}</p>
                {report.district?.name && <p className="text-tinta2">{report.district.name}</p>}
                {report.pestDetail?.intensity_level && (
                  <p>Keparahan: {report.pestDetail.intensity_level}</p>
                )}
                {report.irrigationDetail?.physical_condition && (
                  <p>Kondisi: {report.irrigationDetail.physical_condition}</p>
                )}
                <Link className="font-semibold text-green-800 underline" to={`/reports/${report.id}`}>
                  Buka laporan
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {clusters && showClusters && <ClusterLayer clusters={clusters} />}
      </MapContainer>
    </div>
  );
}

export function MapLegend({ types }: { types: ReportType[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {types.map((type) => (
        <li key={type} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tinta2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white"
            style={{ backgroundColor: TYPE_COLOR[type] }}
          />
          {REPORT_TYPE_LABEL[type]}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tinta2">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500/70 ring-1 ring-orange-700" />
        Zona Waspada / Kluster
      </li>
    </ul>
  );
}
