#!/usr/bin/env python3
"""Sinkronisasi master wilayah & SLS Kabupaten Jember (BPS 3509) dari MFD resmi.

Sumber kebenaran: data/MFD/sls_3509_sudah_validasi_disolve_fill gap.xlsx
Sumber koordinat: data/poligon sls/*.geojson (bounding-box center per kecamatan)

Menghasilkan:
  apps/api/database/data/districts.json  (31 kecamatan, kode resmi BPS)
  apps/api/database/data/villages.json   (248 desa/kelurahan, iddesa 10 digit)
  apps/api/database/data/sls.json        (16.776 SLS: RT/RW/Dusun)
"""

import glob
import json
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

def bbox_center_for(code7: str):
    files = [f for d in GEO_DIRS for f in glob.glob(str(d / f"sls_{code7}*.geojson"))]
    if not files:
        return None
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for path in files:
        with open(path, encoding="utf-8") as fh:
            gj = json.load(fh)
        for feature in gj.get("features", []):
            geom = feature.get("geometry") or {}
            for x, y in iter_coords(geom.get("coordinates") or []):
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if minx == float("inf"):
        return None
    return round((minx + maxx) / 2, 6), round((miny + maxy) / 2, 6)

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
        "idsls": str(row[idx["idsls"]]).strip(),
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

district_out = []
for dcode in sorted(districts):
    center = bbox_center_for(dcode)
    lat, lon = (round(center[1], 6), round(center[0], 6)) if center else (None, None)
    if center:
        print(f"{dcode} {districts[dcode]['name']:<14} centroid=({lat}, {lon})  desa={len(districts[dcode]['villages'])}")
    else:
        print(f"{dcode} {districts[dcode]['name']:<14} centroid=GAGAL")
    district_out.append({
        "legacy_id": len(district_out) + 1,
        "code": dcode,
        "name": districts[dcode]["name"],
        "latitude": lat,
        "longitude": lon,
        "villages_count": len(districts[dcode]["villages"]),
    })

village_out = [villages[vcode] for vcode in sorted(villages)]
sls_out = sorted(sls, key=lambda item: item["idsls"])

(DATA_DIR / "districts.json").write_text(json.dumps(district_out, ensure_ascii=False, indent=4), encoding="utf-8")
(DATA_DIR / "villages.json").write_text(json.dumps(village_out, ensure_ascii=False, indent=4), encoding="utf-8")
(DATA_DIR / "sls.json").write_text(json.dumps(sls_out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print(f"OK districts={len(district_out)} villages={len(village_out)} sls={len(sls_out)}")
