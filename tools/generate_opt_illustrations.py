#!/usr/bin/env python3
"""Generate ilustrasi skematis SVG untuk katalog OPT pangan (14 OPT).
Bukan foto identifikasi — diagram skematis untuk edukasi & UI."""

from pathlib import Path

OUT = Path("apps/web/public/opt")
OUT.mkdir(parents=True, exist_ok=True)

BG = "#F7FAF5"
STROKE = "#DDE5DC"
INK = "#1B2A21"
SAWAH = "#133D2B"
PADI = "#B45309"
DANGER = "#B91C1C"
OK = "#166534"


def svg(body: str, accent: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="Ilustrasi skematis OPT">
  <rect width="320" height="220" rx="16" fill="{BG}" stroke="{STROKE}"/>
  <circle cx="288" cy="32" r="14" fill="{accent}" opacity="0.15"/>
  <circle cx="288" cy="32" r="5" fill="{accent}"/>
  <g stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="{SAWAH}">
{body}
  </g>
</svg>"""


def beetle(cx=160, cy=118, s=1.0, accent=DANGER):
    def p(x, y):
        return f"{cx + x*s:.1f},{cy + y*s:.1f}"
    return svg(f"""    <line x1="{cx-34*s}" y1="{cy-30*s}" x2="{cx-58*s}" y2="{cy-52*s}"/>
    <line x1="{cx+34*s}" y1="{cy-30*s}" x2="{cx+58*s}" y2="{cy-52*s}"/>
    <ellipse cx="{cx}" cy="{cy+8*s}" rx="{44*s}" ry="{40*s}" fill="{SAWAH}" fill-opacity="0.9"/>
    <ellipse cx="{cx}" cy="{cy+12*s}" rx="{16*s}" ry="{28*s}" fill="{BG}" fill-opacity="0.25" stroke="none"/>
    <circle cx="{cx}" cy="{cy-38*s}" r="{18*s}"/>
    <line x1="{cx}" y1="{cy-30*s}" x2="{cx}" y2="{cy+44*s}" stroke="{BG}" stroke-width="3"/>
    <line x1="{cx-44*s}" y1="{cy+2*s}" x2="{cx-66*s}" y2="{cy+18*s}"/>
    <line x1="{cx+44*s}" y1="{cy+2*s}" x2="{cx+66*s}" y2="{cy+18*s}"/>
    <line x1="{cx-40*s}" y1="{cy+28*s}" x2="{cx-60*s}" y2="{cy+46*s}"/>
    <line x1="{cx+40*s}" y1="{cy+28*s}" x2="{cx+60*s}" y2="{cy+46*s}"/>""", accent)


def moth(cx=160, cy=116, s=1.0, accent=DANGER):
    return svg(f"""    <ellipse cx="{cx-38*s}" cy="{cy-6*s}" rx="{40*s}" ry="{26*s}" transform="rotate(-25 {cx-38*s} {cy-6*s})" fill="{SAWAH}" fill-opacity="0.85"/>
    <ellipse cx="{cx+38*s}" cy="{cy-6*s}" rx="{40*s}" ry="{26*s}" transform="rotate(25 {cx+38*s} {cy-6*s})" fill="{SAWAH}" fill-opacity="0.85"/>
    <ellipse cx="{cx-28*s}" cy="{cy+34*s}" rx="{24*s}" ry="{15*s}" transform="rotate(20 {cx-28*s} {cy+34*s})" fill="{SAWAH}" fill-opacity="0.7"/>
    <ellipse cx="{cx+28*s}" cy="{cy+34*s}" rx="{24*s}" ry="{15*s}" transform="rotate(-20 {cx+28*s} {cy+34*s})" fill="{SAWAH}" fill-opacity="0.7"/>
    <ellipse cx="{cx}" cy="{cy+10*s}" rx="{10*s}" ry="{30*s}"/>
    <circle cx="{cx}" cy="{cy-30*s}" r="{11*s}"/>""", accent)


def caterpillar(cx=160, cy=130, s=1.0, accent=DANGER):
    segs = [(-72, 10, 16), (-48, 4, 17), (-24, 0, 18), (0, -2, 18), (24, 0, 17), (48, 4, 16), (72, 10, 14)]
    body = "\n".join(
        f'    <circle cx="{cx + x*s}" cy="{cy + y*s}" r="{r*s}" fill="{SAWAH}" fill-opacity="0.9"/>'
        for x, y, r in segs
    )
    return svg(body + f"""
    <line x1="{cx-88*s}" y1="{cy-6*s}" x2="{cx-100*s}" y2="{cy-16*s}"/>
    <circle cx="{cx+70*s}" cy="{cy-4*s}" r="{3*s}" fill="{INK}" stroke="none"/>""", accent)


def rodent(cx=160, cy=126, s=1.0, accent=DANGER):
    return svg(f"""    <path d="M {cx-64*s} {cy+34*s} Q {cx-78*s} {cy+6*s} {cx-46*s} {cy-8*s}" fill="none"/>
    <ellipse cx="{cx-6*s}" cy="{cy+16*s}" rx="{58*s}" ry="{34*s}" fill="{SAWAH}" fill-opacity="0.9"/>
    <circle cx="{cx+52*s}" cy="{cy+2*s}" r="{22*s}"/>
    <path d="M {cx+44*s} {cy-16*s} L {cx+46*s} {cy-30*s} L {cx+58*s} {cy-18*s} Z"/>
    <path d="M {cx+62*s} {cy-16*s} L {cx+64*s} {cy-30*s} L {cx+74*s} {cy-16*s} Z"/>
    <circle cx="{cx+58*s}" cy="{cy+2*s}" r="2.6" fill="{BG}" stroke="none"/>""", accent)


def fungus(cx=160, cy=128, s=1.0, accent=DANGER):
    return svg(f"""    <path d="M {cx-52*s} {cy-2*s} Q {cx} {cy-66*s} {cx+52*s} {cy-2*s} Z" fill="{SAWAH}" fill-opacity="0.9"/>
    <rect x="{cx-12*s}" y="{cy-2*s}" width="{24*s}" height="{44*s}" rx="{6*s}"/>
    <circle cx="{cx-24*s}" cy="{cy-16*s}" r="{6*s}" fill="{BG}" fill-opacity="0.6" stroke="none"/>
    <circle cx="{cx+14*s}" cy="{cy-30*s}" r="{5*s}" fill="{BG}" fill-opacity="0.6" stroke="none"/>
    <circle cx="{cx+32*s}" cy="{cy-8*s}" r="{4*s}" fill="{BG}" fill-opacity="0.6" stroke="none"/>""", accent)


def bacterium(cx=160, cy=124, s=1.0, accent=DANGER):
    rods = [(-56, 10, -30), (-28, -28, 20), (0, 16, -15), (28, -18, 35), (56, 12, -25), (-8, -44, 10), (36, 40, 5)]
    body = "\n".join(
        f'    <rect x="{cx + x*s - 8*s}" y="{cy + y*s - 16*s}" width="{16*s}" height="{32*s}" rx="{8*s}" transform="rotate({rot} {cx + x*s} {cy + y*s})" fill="{SAWAH}" fill-opacity="0.88"/>'
        for x, y, rot in rods
    )
    return svg(body, accent)


def snail(cx=160, cy=130, s=1.0, accent=PADI):
    return svg(f"""    <path d="M {cx-70*s} {cy+30*s} Q {cx-40*s} {cy+34*s} {cx+20*s} {cy+30*s}" fill="none"/>
    <circle cx="{cx+42*s}" cy="{cy+22*s}" r="{14*s}"/>
    <circle cx="{cx-18*s}" cy="{cy+2*s}" r="{40*s}" fill="{SAWAH}" fill-opacity="0.9"/>
    <path d="M {cx-18*s} {cy-32*s} A 34 34 0 1 1 {cx-44*s} {cy+22*s}" fill="none" stroke="{BG}" stroke-width="3"/>
    <path d="M {cx-18*s} {cy-14*s} A 16 16 0 1 1 {cx-31*s} {cy+10*s}" fill="none" stroke="{BG}" stroke-width="3"/>
    <line x1="{cx+50*s}" y1="{cy+8*s}" x2="{cx+56*s}" y2="{cy-4*s}"/>
    <line x1="{cx+36*s}" y1="{cy+8*s}" x2="{cx+31*s}" y2="{cy-4*s}"/>""", accent)


def mite(cx=160, cy=124, s=1.0, accent=PADI):
    legs = []
    for i, dy in enumerate([-28, -10, 8, 26]):
        legs.append(f'    <line x1="{cx-20*s}" y1="{cy+dy*s}" x2="{cx-52*s}" y2="{cy+(dy-14 + i*10)*s}"/>')
        legs.append(f'    <line x1="{cx+20*s}" y1="{cy+dy*s}" x2="{cx+52*s}" y2="{cy+(dy-14 + i*10)*s}"/>')
    return svg("\n".join(legs) + f"""
    <ellipse cx="{cx}" cy="{cy}" rx="{26*s}" ry="{42*s}" fill="{SAWAH}" fill-opacity="0.9"/>
    <ellipse cx="{cx}" cy="{cy+6*s}" rx="{12*s}" ry="{24*s}" fill="{BG}" fill-opacity="0.2" stroke="none"/>""", accent)


FIGURES = {
    "wereng-batang-coklat": beetle(accent=DANGER),
    "penggerek-batang-padi-kuning": moth(accent=DANGER),
    "tikus-sawah": rodent(accent=DANGER),
    "walang-sangit": beetle(accent=PADI),
    "penyakit-blas-padi": fungus(accent=DANGER),
    "hawar-daun-bakteri": bacterium(accent=DANGER),
    "keong-mas": snail(accent=PADI),
    "ulat-grayak-jagung": caterpillar(accent=DANGER),
    "penyakit-bulai-jagung": fungus(accent=DANGER),
    "penggerek-tongkol-jagung": moth(accent=PADI),
    "ulat-grayak-kedelai": caterpillar(accent=DANGER),
    "penggerek-polong-kedelai": moth(accent=PADI),
    "tungau-merah-singkong": mite(accent=PADI),
    "hama-boleng-ubi-jalar": beetle(accent=PADI),
}

for name, content in FIGURES.items():
    (OUT / f"{name}.svg").write_text(content, encoding="utf-8")
    print("wrote", OUT / f"{name}.svg")
print("done", len(FIGURES), "ilustrasi")
