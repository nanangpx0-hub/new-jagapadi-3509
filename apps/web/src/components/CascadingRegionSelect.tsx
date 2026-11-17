import { Building2, ChevronDown, LandPlot, Loader2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDistricts, listVillageSls, listVillages } from '../lib/api';
import type { SlsItem } from '../lib/types';

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

// Cache sederhana untuk label SLS yang terpilih saat daftar hasil server terfilter.
const SlsItemCache = new Map<number, SlsItem>();

interface Props {
  selectedDistrictId?: number;
  selectedVillageId?: number;
  selectedSlsId?: number | null;
  onDistrictChange?: (district: DistrictItem | null) => void;
  onVillageChange?: (village: VillageItem | null) => void;
  onSlsChange?: (sls: SlsItem | null) => void;
}

const selectClass =
  'w-full appearance-none rounded-lg border border-garis bg-panel2 py-2.5 pl-3.5 pr-10 text-sm font-medium text-tinta transition-all hover:border-cta/50 focus:border-cta focus:bg-panel focus:outline-none focus:ring-2 focus:ring-cta/20 disabled:cursor-not-allowed disabled:opacity-60';
const labelClass =
  'mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-tinta2';

export function CascadingRegionSelect({
  selectedDistrictId,
  selectedVillageId,
  selectedSlsId,
  onDistrictChange,
  onVillageChange,
  onSlsChange,
}: Props) {
  const [districtId, setDistrictId] = useState<number | undefined>(selectedDistrictId);
  const [villageId, setVillageId] = useState<number | undefined>(selectedVillageId);
  const [slsId, setSlsId] = useState<number | null>(selectedSlsId ?? null);
  const [slsSearch, setSlsSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [slsOpen, setSlsOpen] = useState(false);

  // Ikuti perubahan nilai dari parent (mis. auto-locate dari koordinat GPS/EXIF).
  useEffect(() => { setDistrictId(selectedDistrictId); }, [selectedDistrictId]);
  useEffect(() => { setVillageId(selectedVillageId); }, [selectedVillageId]);
  useEffect(() => { setSlsId(selectedSlsId ?? null); }, [selectedSlsId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(slsSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [slsSearch]);

  // 1. Fetch 31 Kecamatan Jember.
  // Wajib memakai listDistricts() yang mengembalikan array — queryKey ['districts']
  // dipakai bersama MapPage/ReportsPage, jadi bentuk cache harus identik.
  const districtsQuery = useQuery<DistrictItem[]>({
    queryKey: ['districts'],
    queryFn: listDistricts,
  });

  // 2. Fetch Desa di bawah Kecamatan terpilih (bentuk cache juga harus array).
  const villagesQuery = useQuery<VillageItem[]>({
    queryKey: ['villages', districtId],
    queryFn: () => (districtId ? listVillages(districtId) : Promise.resolve([])),
    enabled: !!districtId,
  });

  // 3. Fetch SLS di bawah Desa terpilih (server-side search untuk autocomplete)
  const slsQuery = useQuery({
    queryKey: ['village-sls', villageId, debouncedSearch],
    queryFn: () => listVillageSls(villageId!, debouncedSearch || undefined),
    enabled: !!villageId && !!onSlsChange,
  });

  const slsItems = slsQuery.data?.data ?? [];
  const selectedSls =
    slsItems.find((item) => item.id === slsId) ?? (slsId ? SlsItemCache.get(slsId) : undefined) ?? null;

  const handleDistrictSelect = (id: number) => {
    setDistrictId(id);
    setVillageId(undefined);
    setSlsId(null);
    setSlsSearch('');
    const d = districtsQuery.data?.find((item) => item.id === id) ?? null;
    onDistrictChange?.(d);
    onVillageChange?.(null);
    onSlsChange?.(null);
  };

  const handleVillageSelect = (id: number) => {
    setVillageId(id);
    setSlsId(null);
    setSlsSearch('');
    const v = villagesQuery.data?.find((item) => item.id === id) ?? null;
    onVillageChange?.(v);
    onSlsChange?.(null);
  };

  const handleSlsSelect = (item: SlsItem) => {
    SlsItemCache.set(item.id, item);
    setSlsId(item.id);
    setSlsSearch('');
    setSlsOpen(false);
    onSlsChange?.(item);
  };

  const clearSls = () => {
    setSlsId(null);
    setSlsSearch('');
    onSlsChange?.(null);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="crs-district">
          <Building2 size={15} className="text-cta" aria-hidden="true" />
          Kecamatan (Kabupaten Jember)
        </label>
        <div className="relative">
          <select
            id="crs-district"
            className={selectClass}
            value={districtId ?? ''}
            onChange={(e) => handleDistrictSelect(Number(e.target.value))}
            disabled={districtsQuery.isLoading}
          >
            <option value="">-- Pilih Kecamatan ({districtsQuery.data?.length ?? 0}) --</option>
            {districtsQuery.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name} ({d.villages_count ?? 0} Desa)
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-tinta3">
            {districtsQuery.isLoading ? (
              <Loader2 size={16} className="animate-spin text-cta" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="crs-village">
          <LandPlot size={15} className="text-cta" aria-hidden="true" />
          Desa / Kelurahan
        </label>
        <div className="relative">
          <select
            id="crs-village"
            className={`${selectClass} disabled:bg-panel2/50 disabled:text-tinta3`}
            value={villageId ?? ''}
            onChange={(e) => handleVillageSelect(Number(e.target.value))}
            disabled={!districtId || villagesQuery.isLoading}
          >
            <option value="">
              {!districtId
                ? '-- Pilih kecamatan terlebih dahulu --'
                : villagesQuery.isLoading
                ? 'Memuat desa...'
                : `-- Pilih Desa (${villagesQuery.data?.length ?? 0}) --`}
            </option>
            {villagesQuery.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} - {v.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-tinta3">
            {villagesQuery.isLoading ? (
              <Loader2 size={16} className="animate-spin text-cta" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {onSlsChange && (
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="crs-sls">
            <Search size={15} className="text-cta" aria-hidden="true" />
            SLS / Dusun / RW (opsional)
          </label>
          {slsId && selectedSls ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-cta/40 bg-cta/10 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-tinta">
                  {selectedSls.name}
                </p>
                <p className="font-mono text-[11px] text-tinta3">
                  {selectedSls.code} · {selectedSls.idsls}
                </p>
              </div>
              <button
                type="button"
                onClick={clearSls}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-tinta2 hover:text-tinta"
                aria-label="Hapus pilihan SLS"
              >
                <X size={14} aria-hidden="true" /> Hapus
              </button>
            </div>
          ) : (
            <div className="relative" onBlur={() => setSlsOpen(false)}>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta3"
                aria-hidden="true"
              />
              <input
                id="crs-sls"
                type="search"
                role="combobox"
                aria-expanded={slsOpen}
                aria-controls="crs-sls-listbox"
                autoComplete="off"
                placeholder={
                  !villageId
                    ? 'Pilih desa terlebih dahulu'
                    : 'Ketik nama RT/RW/Dusun atau kode…'
                }
                className="w-full rounded-lg border border-garis bg-panel2 py-2.5 pl-9 pr-3 text-sm font-medium text-tinta placeholder:text-tinta3 transition-all hover:border-cta/50 focus:border-cta focus:bg-panel focus:outline-none focus:ring-2 focus:ring-cta/20 disabled:cursor-not-allowed disabled:opacity-60"
                value={slsSearch}
                disabled={!villageId || slsQuery.isLoading}
                onChange={(e) => {
                  setSlsSearch(e.target.value);
                  setSlsOpen(true);
                }}
                onFocus={() => setSlsOpen(true)}
              />
              {slsQuery.isLoading && (
                <Loader2
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cta"
                  aria-hidden="true"
                />
              )}
              {slsOpen && villageId && slsItems.length > 0 && (
                <ul
                  id="crs-sls-listbox"
                  role="listbox"
                  className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-garis bg-panel shadow-card"
                >
                  {slsItems.map((item) => (
                    <li key={item.id} role="option" aria-selected={item.id === slsId}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSlsSelect(item)}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-panel2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-tinta">
                            {item.name}
                          </span>
                          <span className="block font-mono text-[11px] text-tinta3">
                            {item.code} · {item.idsls}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {slsOpen && villageId && !slsQuery.isLoading && slsItems.length === 0 && (
                <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-garis bg-panel px-3.5 py-3 text-sm text-tinta2 shadow-card">
                  Tidak ada SLS cocok dengan pencarian.
                </div>
              )}
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-tinta3">
            Opsional. Bantu memetakan lokasi lebih presisi sampai tingkat Dusun/RW.
          </p>
        </div>
      )}
    </div>
  );
}
