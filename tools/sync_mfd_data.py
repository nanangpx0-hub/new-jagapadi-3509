#!/usr/bin/env python3
"""Sinkronisasi master wilayah & SLS Kabupaten Jember (BPS 3509) dari MFD resmi.

Sumber kebenaran: data/MFD/sls_3509_sudah_validasi_disolve_fill gap.xlsx
Sumber koordinat: data/poligon sls/**/*.geojson (bounding-box per kecamatan, desa, SLS).

Menghasilkan:
  apps/api/database/data/districts.json  (31 kecamatan, kode resmi BPS)
  apps/api/database/data/villages.json   (248 desa/kelurahan, iddesa 10 digit + bbox center)
  apps/api/database/data/sls.json        (16.776 SLS: RT/RW/Dusun + bbox center)
"""

import glob
import json
import math
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
MFD = ROOT / "data" / "MFD" / "sls_3509_sudah_validasi_disolve_fill gap.xlsx"
GEO_DIRS = [ROOT / "data" / "poligon sls" / "1. Pengolahan Peta tanpa pemekaran dan penggabungan",
            ROOT / "data" / "poligon sls" / "2. Pengolahan Peta dengan pemekaran dan penggabungan"]
DATA_DIR = ROOT / "apps" / "api" / "database" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

EXPECTED_EC_CODES = [f"{i:03d}" for i in range(10, 290, 10)] + ["710", "720", "730"]
assert len(EXPECTED_EC_CODES) == 31


def title_id(text: str) -> str:
    """Title-case Bahasa Indonesia; menjaga RT/RW/DUSUN/dst."""
    s = re.sub(r"\s+", " ", str(text or "").strip())
    words = []
    for word in s.split(" "):
        if word.upper() in {"RT", "RW", "RTRW", "DUSUN", "DK", "KEL", "SL", "AWLR"}:
            words.append(word.upper())
        else:
            words.append(word[:1].upper() + word[1:].lower() if word else word)
    return " ".join(words)


def district_code(kdkec: str) -> str:
    return "3509" + str(kdkec).strip()


def iter_coords(obj):
    if isinstance(obj, (list, tuple)):
        if len(obj) >= 2 and all(isinstance(v, (int, float)) for v in obj[:2]):
            yield obj[0], obj[1]
        else:
            for item in obj:
                yield from iter_coords(item)


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Jarakpermukaan bumi (meter) antara dua titik (lon, lat) derajat."""
    radius = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(a)))


def load_bboxes():
    """Kumpulkan bbox (minx, miny, maxx, maxy) per kecamatan, desa, dan SLS.

    Kunci: kode kecamatan 7 digit, iddesa 10 digit, dan idsls 14 digit.
    Sumber: seluruh feature GeoJSON di dua folder poligon wilayah.
    """
    district_b: dict[str, list[float]] = {}
    village_b: dict[str, list[float]] = {}
    sls_b: dict[str, list[float]] = {}
    inf, ninf = float("inf"), float("-inf")
    visited = set()

    for folder in GEO_DIRS:
        for path in sorted(glob.glob(str(folder / "*.geojson"))):
            if path in visited:
                continue
            visited.add(path)
            with open(path, encoding="utf-8") as fh:
                gj = json.load(fh)
            for feature in gj.get("features", []):
                props = feature.get("properties") or {}
                coords = (feature.get("geometry") or {}).get("coordinates") or []
                points = list(iter_coords(coords))
                if not points:
                    continue
                kdkec = str(props.get("kdkec") or "").strip()
                iddesa = str(props.get("iddesa") or "").strip()
                idsls = str(props.get("idsls") or "").strip()
                targets = []
                if kdkec:
                    targets.append((district_b, district_code(kdkec)))
                if iddesa:
                    targets.append((village_b, iddesa))
                if idsls:
                    targets.append((sls_b, idsls))
                for store, key in targets:
                    box = store.setdefault(key, [inf, inf, ninf, ninf])
                    for x, y in points:
                        if x < box[0]:
                            box[0] = x
                        if y < box[1]:
                            box[1] = y
                        if x > box[2]:
                            box[2] = x
                        if y > box[3]:
                            box[3] = y

    print(f"geojson: {len(visited)} file | bbox kecamatan={len(district_b)} desa={len(village_b)} sls={len(sls_b)}")
    return district_b, village_b, sls_b


def bbox_center(box):
    """Titik tengah bounding box -> (latitude, longitude)."""
    if not box or box[0] == float("inf"):
        return None, None
    return round((box[1] + box[3]) / 2, 6), round((box[0] + box[2]) / 2, 6)


DISTRICT_BBOX, VILLAGE_BBOX, SLS_BBOX = load_bboxes()

wb = openpyxl.load_workbook(MFD, read_only=True, data_only=True)
ws = wb["sls_3509_sudah_validasi_disolve"]
rows = list(ws.iter_rows(values_only=True))
header = list(rows[0])
idx = {name: header.index(name) for name in [
    "kk", "luas", "idsls", "kdkec", "kdsls", "nmkec", "nmsls", "kddesa", "muatan", "nmdesa", "iddesa",
]}
print(f"rows: {len(rows) - 1}")

districts = {}
villages = {}
sls = []
rows = list(rows[1:])
seen_idsls = set()
agg = {}  # idsls -> {'kk': int, 'muatan': int, 'row': row}
for row in rows:
    if row[idx["idsls"]] is None:
        continue
    key = str(row[idx["idsls"]]).strip()
    try:
        kk = int(float(row[idx["kk"]])) if row[idx["kk"]] not in (None, "") else 0
    except (ValueError, TypeError):
        kk = 0
    try:
        muatan = int(float(row[idx["muatan"]])) if row[idx["muatan"]] not in (None, "") else 0
    except (ValueError, TypeError):
        muatan = 0
    if key not in agg:
        agg[key] = {"kk": 0, "muatan": 0, "row": row}
    agg[key]["kk"] += kk
    agg[key]["muatan"] += muatan

print(f"sls: {len(rows)} baris di input, {len(agg)} SLS unik (sub-SLS diagregasi)")
rows = [v["row"] for v in agg.values()]
# simpan agregat untuk dipakai saat membangun sls.json
_SLS_AGG = agg
for row in rows:
    kdkec = str(row[idx["kdkec"]]).strip()
    kddesa = str(row[idx["kddesa"]]).strip().zfill(3)
    dcode = district_code(kdkec)
    vcode = str(row[idx["iddesa"]]).strip() if row[idx["iddesa"]] else dcode + kddesa
    if dcode not in districts:
        districts[dcode] = {"code": dcode, "name": title_id(row[idx["nmkec"]]), "villages": set()}
    districts[dcode]["villages"].add(vcode)
    if vcode not in villages:
        villages[vcode] = {"district_code": dcode, "code": vcode, "name": title_id(row[idx["nmdesa"]])}
    key_idsls = str(row[idx["idsls"]]).strip()
    agg_row = _SLS_AGG[key_idsls]
    kk = agg_row["kk"]
    muatan = agg_row["muatan"]
    try:
        luas = float(row[idx["luas"]]) if row[idx["luas"]] not in (None, "") else None
    except (ValueError, TypeError):
        luas = None
    sls.append({
        "idsls": key_idsls,
        "code": str(row[idx["kdsls"]]).strip().zfill(4),
        "name": title_id(row[idx["nmsls"]]),
        "village_code": vcode,
        "district_code": dcode,
        "kk": kk,
        "muatan": muatan,
        "luas": round(luas, 6) if luas is not None else None,
    })

print(f"districts: {len(districts)} | villages: {len(villages)} | sls: {len(sls)}")
missing = [c for c in EXPECTED_EC_CODES if "3509" + c not in districts]
if missing:
    print("PERINGATAN: kode kecamatan tidak ditemukan di Excel:", missing)

# --- 1. Kecamatan: titik tengah bbox kecamatan (fallback nama file lama) ---
def legacy_district_center(code7: str):
    files = [f for d in GEO_DIRS for f in glob.glob(str(d / f"sls_{code7}*.geojson"))]
    if not files:
        return None
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for path in files:
        with open(path, encoding="utf-8") as fh:
            gj = json.load(fh)
        for feature in gj.get("features", []):
            for x, y in iter_coords((feature.get("geometry") or {}).get("coordinates") or []):
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
    if minx == float("inf"):
        return None
    return (minx + maxx) / 2, (miny + maxy) / 2


district_out = []
district_centers = {}
for dcode in sorted(districts):
    lat, lon = bbox_center(DISTRICT_BBOX.get(dcode))
    if lat is None:
        fallback = legacy_district_center(dcode)
        if fallback:
            lon, lat = round(fallback[0], 6), round(fallback[1], 6)
    district_centers[dcode] = (lat, lon)
    district_out.append({
        "legacy_id": len(district_out) + 1,
        "code": dcode,
        "name": districts[dcode]["name"],
        "latitude": lat,
        "longitude": lon,
        "villages_count": len(districts[dcode]["villages"]),
    })

# --- 2. Desa: bbox desa -> center + radius diagonal/2 + buffer 500 m ---
village_out = []
for vcode in sorted(villages):
    village = villages[vcode]
    lat, lon = bbox_center(VILLAGE_BBOX.get(vcode))
    if lat is None:
        # Fallback ke titik tengah kecamatan bila geometri desa tidak ada.
        lat, lon = district_centers.get(village["district_code"], (None, None))
        radius = 3000.0
    else:
        box = VILLAGE_BBOX[vcode]
        diagonal = haversine_m(box[0], box[1], box[2], box[3])
        radius = round(min(8000.0, max(1500.0, diagonal / 2 + 500)), 1)
    village["latitude"] = lat
    village["longitude"] = lon
    village["fallback_radius_m"] = radius
    village_out.append(village)

# --- 3. SLS: bbox SLS -> center (None bila tanpa geometri) ---
for item in sls:
    lat, lon = bbox_center(SLS_BBOX.get(item["idsls"]))
    item["latitude"] = lat
    item["longitude"] = lon

sls_out = sorted(sls, key=lambda item: item["idsls"])

(DATA_DIR / "districts.json").write_text(json.dumps(district_out, ensure_ascii=False, indent=4), encoding="utf-8")
(DATA_DIR / "villages.json").write_text(json.dumps(village_out, ensure_ascii=False, indent=4), encoding="utf-8")
(DATA_DIR / "sls.json").write_text(json.dumps(sls_out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

with_coord = sum(1 for v in village_out if v["latitude"] is not None)
sls_with_coord = sum(1 for s in sls_out if s["latitude"] is not None)
print(f"OK districts={len(district_out)} villages={len(village_out)} (berkoordinat: {with_coord}) "
      f"sls={len(sls_out)} (berkoordinat: {sls_with_coord})")
