import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface DistrictItem {
  id: number;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  villages_count?: number;
}

export interface VillageItem {
  id: number;
  district_id: number;
  code: string;
  name: string;
  fallback_radius_m: number | null;
}

interface Props {
  selectedDistrictId?: number;
  selectedVillageId?: number;
  onDistrictChange?: (district: DistrictItem | null) => void;
  onVillageChange?: (village: VillageItem | null) => void;
}

export function CascadingRegionSelect({
  selectedDistrictId,
  selectedVillageId,
  onDistrictChange,
  onVillageChange,
}: Props) {
  const [districtId, setDistrictId] = useState<number | undefined>(selectedDistrictId);
  const [villageId, setVillageId] = useState<number | undefined>(selectedVillageId);

  // 1. Fetch 31 Kecamatan Jember
  const districtsQuery = useQuery<{ status: string; data: DistrictItem[] }>({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await fetch('/api/districts');
      if (!res.ok) throw new Error('Gagal memuat data kecamatan');
      return res.json();
    },
  });

  // 2. Fetch Desa di bawah Kecamatan terpilih
  const villagesQuery = useQuery<{ status: string; data: VillageItem[] }>({
    queryKey: ['villages', districtId],
    queryFn: async () => {
      if (!districtId) return { status: 'ok', data: [] };
      const res = await fetch(`/api/districts/${districtId}/villages`);
      if (!res.ok) throw new Error('Gagal memuat data desa');
      return res.json();
    },
    enabled: !!districtId,
  });

  const handleDistrictSelect = (id: number) => {
    setDistrictId(id);
    setVillageId(undefined);
    const d = districtsQuery.data?.data.find((item) => item.id === id) ?? null;
    onDistrictChange?.(d);
    onVillageChange?.(null);
  };

  const handleVillageSelect = (id: number) => {
    setVillageId(id);
    const v = villagesQuery.data?.data.find((item) => item.id === id) ?? null;
    onVillageChange?.(v);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Kecamatan (Kabupaten Jember)
        </label>
        <select
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:ring-2 focus:ring-green-600 focus:outline-none"
          value={districtId ?? ''}
          onChange={(e) => handleDistrictSelect(Number(e.target.value))}
          disabled={districtsQuery.isLoading}
        >
          <option value="">-- Pilih Kecamatan ({districtsQuery.data?.data.length ?? 0}) --</option>
          {districtsQuery.data?.data.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} - {d.name} ({d.villages_count ?? 0} Desa)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Desa / Kelurahan
        </label>
        <select
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:ring-2 focus:ring-green-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
          value={villageId ?? ''}
          onChange={(e) => handleVillageSelect(Number(e.target.value))}
          disabled={!districtId || villagesQuery.isLoading}
        >
          <option value="">
            {!districtId
              ? '-- Pilih kecamatan terlebih dahulu --'
              : villagesQuery.isLoading
              ? 'Memuat desa...'
              : `-- Pilih Desa (${villagesQuery.data?.data.length ?? 0}) --`}
          </option>
          {villagesQuery.data?.data.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} - {v.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
