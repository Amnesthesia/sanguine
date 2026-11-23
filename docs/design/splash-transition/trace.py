#!/usr/bin/env python3
"""Retrace the client's emblem and logotype (docs/brand-v2/*.png) into polygons and build the morph data for the
splash-to-app transition prototype (owner, 2026-11-23: retracing the logo is allowed for this).

Writes, next to this file:
  data.js              window.SPLASH = { phone, lockup, crescent, shapes } for index.html
  emblem-traced.svg    the retraced emblem and logotype as smooth outlines (potrace SVG), white on transparent
  trace-check.png      the retrace in red over the original PNGs, and the fitted crescent, to check fidelity

Needs: potrace (brew install potrace), Python 3 with numpy and Pillow.
Run:   python3 docs/design/splash-transition/trace.py
"""
import json, math, os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(ROOT, 'docs', 'brand-v2')
UP = 4  # upscale before tracing, for smoother outlines

# Splash geometry in points, as the app draws it (BrandSplash.tsx, tools/brand/build.ts lockupSvg).
PHONE = (393, 852)
LOCKUP_W = 260.0
EMBLEM_SHARE, LOCKUP_GAP_PX, LOCKUP_W_PX = 0.9, 56, 780


def trace(name):
    """potrace one white-on-transparent PNG; returns (polygons in source px with y down, (w, h), svg text)."""
    im = Image.open(os.path.join(SRC, name)).convert('RGBA')
    w, h = im.size
    a = im.split()[3].resize((w * UP, h * UP), Image.LANCZOS).point(lambda v: 0 if v >= 128 else 255).convert('1')
    with tempfile.TemporaryDirectory() as d:
        pbm = os.path.join(d, 'a.pbm')
        a.save(pbm)
        gj = subprocess.run(['potrace', '-b', 'geojson', '-t', '8', pbm, '-o', '-'], check=True, capture_output=True).stdout
        svg = subprocess.run(['potrace', '-b', 'svg', '-t', '8', '--flat', '-C', '#ffffff', pbm, '-o', '-'], check=True, capture_output=True, text=True).stdout
    H = h * UP
    polys = []
    for f in json.loads(gj)['features']:
        rings = [np.array([(x / UP, (H - y) / UP) for x, y in r[:-1]]) for r in f['geometry']['coordinates']]  # potrace y is up
        polys.append(rings)
    return polys, (w, h), svg


def resample(r, n):
    """n points evenly spaced by arc length around the closed ring r."""
    p = np.vstack([r, r[:1]])
    seg = np.hypot(*np.diff(p, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], n, endpoint=False)
    return np.column_stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])])


def perimeter(r):
    return float(np.hypot(*np.diff(np.vstack([r, r[:1]]), axis=0).T).sum())


def fit_circle(p):
    """Least-squares (Kasa) circle through points p: (cx, cy, r)."""
    A = np.column_stack([p[:, 0], p[:, 1], np.ones(len(p))])
    b = -(p[:, 0] ** 2 + p[:, 1] ** 2)
    D, E, F = np.linalg.lstsq(A, b, rcond=None)[0]
    cx, cy = -D / 2, -E / 2
    return cx, cy, math.sqrt(cx * cx + cy * cy - F)


emblem, (ew, eh), emblem_svg = trace('emblem.png')
logo, (lw, lh), logo_svg = trace('logotype.png')

# Place both in phone points exactly where the splash lock-up puts them (centred, 260 pt wide).
k = LOCKUP_W / LOCKUP_W_PX
emb_w_pt = LOCKUP_W_PX * EMBLEM_SHARE * k
emb_h_pt = emb_w_pt * eh / ew
logo_h_pt = LOCKUP_W * lh / lw
lock_h_pt = emb_h_pt + LOCKUP_GAP_PX * k + logo_h_pt
x0, y0 = (PHONE[0] - LOCKUP_W) / 2, (PHONE[1] - lock_h_pt) / 2
place_e = lambda r: np.column_stack([x0 + (LOCKUP_W - emb_w_pt) / 2 + r[:, 0] * emb_w_pt / ew, y0 + r[:, 1] * emb_w_pt / ew])
place_l = lambda r: np.column_stack([x0 + r[:, 0] * LOCKUP_W / lw, y0 + emb_h_pt + LOCKUP_GAP_PX * k + r[:, 1] * LOCKUP_W / lw])
emblem = [[place_e(r) for r in p] for p in emblem]
logo = [[place_l(r) for r in p] for p in logo]

# The emblem's own crescent: the topmost polygon (the dot sits below it).
moon = min(emblem, key=lambda p: p[0][:, 1].min())
ring = moon[0]
# Horns: the two outline points farthest apart. They split the outline into the outer (longer) and inner arc.
dd = np.hypot(ring[:, None, 0] - ring[None, :, 0], ring[:, None, 1] - ring[None, :, 1])
i, j = sorted(np.unravel_index(dd.argmax(), dd.shape))
arc1, arc2 = ring[i:j + 1], np.vstack([ring[j:], ring[:i + 1]])
outer, inner = (arc1, arc2) if perimeter(arc1) > perimeter(arc2) else (arc2, arc1)
trim = lambda a: a[len(a) // 8: -len(a) // 8]  # the horn tips are rounded; fit the arcs away from them
oc, ic = fit_circle(trim(outer)), fit_circle(trim(inner))
# oc must be the moon's disk (it holds all the ink) and ic the bite taken out of it (the ink lies on or outside it).
# Arc length alone cannot tell them apart for a thin crescent, so test which circle has ink inside it.
inside = lambda c: float(np.min(np.hypot(ring[:, 0] - c[0], ring[:, 1] - c[1]) - c[2]))
if inside(oc) > inside(ic):
    oc, ic = ic, oc

# The large crescent: the fitted one scaled so the moon's radius is R_BIG, centred on the screen.
R_BIG = 78.0
s = R_BIG / oc[2]
mid = (PHONE[0] / 2, PHONE[1] / 2)  # the screen centre, as in BrandSplash.tsx
big_o = (mid[0], mid[1], R_BIG)
big_i = (mid[0] + (ic[0] - oc[0]) * s, mid[1] + (ic[1] - oc[1]) * s, ic[2] * s)


def circle_hits(c1, c2):
    """The two intersection points of two circles (the horn tips of the crescent)."""
    (x1, y1, r1), (x2, y2, r2) = c1, c2
    d = math.hypot(x2 - x1, y2 - y1)
    a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
    h = math.sqrt(max(r1 * r1 - a * a, 0))
    xm, ym = x1 + a * (x2 - x1) / d, y1 + a * (y2 - y1) / d
    return (xm + h * (y2 - y1) / d, ym - h * (x2 - x1) / d), (xm - h * (y2 - y1) / d, ym + h * (x2 - x1) / d)


h1, h2 = circle_hits(big_o, big_i)
ang = lambda c, p: math.atan2(p[1] - c[1], p[0] - c[0])


def arc_pts(c, a0, a1, n, long_way):
    """n points on circle c from angle a0 to a1, taking the long or the short way round."""
    da = (a1 - a0) % (2 * math.pi)
    if long_way != (da > math.pi):
        da -= 2 * math.pi
    t = np.linspace(0, 1, n)
    return np.column_stack([c[0] + c[2] * np.cos(a0 + da * t), c[1] + c[2] * np.sin(a0 + da * t)])


# Left horn first, so u = 0 is the left horn, u = 1 the right horn, running round the bottom of the bowl.
hl, hr = sorted([h1, h2], key=lambda p: p[0])
o_a0, o_a1 = ang(big_o, hl), ang(big_o, hr)
i_a0, i_a1 = ang(big_i, hl), ang(big_i, hr)


def bend(pts, box):
    """Bend points of the lock-up onto the crescent: x across the lock-up runs horn to horn (u), y down the lock-up runs
    from the bite's edge to the moon's outer edge (v). Outlines and holes keep their order, so the shapes stay whole."""
    bx, by, bw, bh = box
    u = np.clip((pts[:, 0] - bx) / bw, 0, 1)
    v = np.clip((pts[:, 1] - by) / bh, 0, 1)
    def on(c, a0, a1):
        da = (a1 - a0) % (2 * math.pi)
        if da < math.pi:
            da -= 2 * math.pi  # the long way round, under the bowl
        a = a0 + da * u
        return np.column_stack([c[0] + c[2] * np.cos(a), c[1] + c[2] * np.sin(a)])
    inner_edge, outer_edge = on(big_i, i_a0, i_a1), on(big_o, o_a0, o_a1)
    return inner_edge + (outer_edge - inner_edge) * v[:, None]


def npts(r):
    return int(min(max(perimeter(r) / 0.6, 24), 4000))


crescent_ring = np.vstack([arc_pts(big_o, o_a0, o_a1, 200, True), arc_pts(big_i, i_a1, i_a0, 200, True)])

# Every shape (emblem, dot, the logotype's letters) is bent onto the crescent as a whole. The box is the ink's own
# bounds, so the lock-up's left and right edges land on the horns.
allpts = np.vstack([r for p in emblem + logo for r in p])
box = (allpts[:, 0].min(), allpts[:, 1].min(), np.ptp(allpts[:, 0]), np.ptp(allpts[:, 1]))
shapes = []
for kind, group in (('emblem', emblem), ('logo', logo)):
    for p in group:
        rings = []
        for r in p:
            src = resample(r, npts(r))
            rings.append({'from': src, 'to': bend(src, box)})
        shapes.append({'kind': kind, 'u': float((p[0][:, 0].mean() - box[0]) / box[2]), 'rings': rings})

r1 = lambda a: [[round(float(x), 2), round(float(y), 2)] for x, y in a]
data = {
    'phone': PHONE,
    'lockup': {'x': x0, 'y': y0, 'w': LOCKUP_W, 'h': lock_h_pt},
    'box': [round(float(v), 2) for v in box],
    'crescent': {'outer': big_o, 'inner': big_i,  # outer: the moon's disk; inner: the bite (the hole the zoom goes through)
 'd': 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in crescent_ring) + 'Z'},
    'shapes': [{'kind': sh['kind'], 'u': sh['u'], 'rings': [{'from': r1(r['from']), 'to': r1(r['to'])} for r in sh['rings']]} for sh in shapes],
}
with open(os.path.join(HERE, 'data.js'), 'w') as f:
    f.write('// Generated by trace.py; do not edit.\nwindow.SPLASH = ' + json.dumps(data, separators=(',', ':')) + ';\n')

# Retraced outlines as one SVG (emblem over logotype, as in the lock-up), for reuse.
def inner_svg(svg):
    return svg[svg.index('<g'):svg.rindex('</svg>')]
lock_w4, emb_w4 = lw * UP, ew * UP
with open(os.path.join(HERE, 'emblem-traced.svg'), 'w') as f:
    sc = lw / (LOCKUP_W_PX)  # logotype px per lock-up px
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LOCKUP_W_PX} {round(lock_h_pt / k)}">'
            f'<g transform="translate({LOCKUP_W_PX * (1 - EMBLEM_SHARE) / 2} 0) scale({LOCKUP_W_PX * EMBLEM_SHARE / emb_w4})">{inner_svg(emblem_svg)}</g>'
            f'<g transform="translate(0 {emb_h_pt / k + LOCKUP_GAP_PX}) scale({LOCKUP_W_PX / lock_w4})">{inner_svg(logo_svg)}</g></svg>\n')

# Check image: original PNGs in grey, retrace outlines in red, fitted big crescent in blue, at 3x.
S = 3
img = Image.new('RGB', (PHONE[0] * S, PHONE[1] * S), '#F5E8E2')
e_im = Image.open(os.path.join(SRC, 'emblem.png')).convert('RGBA')
l_im = Image.open(os.path.join(SRC, 'logotype.png')).convert('RGBA')
for im, x, y, w in [(e_im, x0 + (LOCKUP_W - emb_w_pt) / 2, y0, emb_w_pt), (l_im, x0, y0 + emb_h_pt + LOCKUP_GAP_PX * k, LOCKUP_W)]:
    im = im.resize((round(w * S), round(w * S * im.size[1] / im.size[0])), Image.LANCZOS)
    grey = Image.new('RGBA', im.size, (120, 120, 120, 255))
    img.paste(grey, (round(x * S), round(y * S)), im)
dr = ImageDraw.Draw(img)
for sh in shapes:
    for r in sh['rings']:
        dr.line([(x * S, y * S) for x, y in np.vstack([r['from'], r['from'][:1]])], fill='#d01c1c', width=1)
dr.polygon([(x * S, y * S) for x, y in crescent_ring], outline='#1c4fd0')
img.save(os.path.join(HERE, 'trace-check.png'))
print(f'{len(shapes)} shapes, {sum(len(s["rings"]) for s in shapes)} rings, {sum(len(r["from"]) for s in shapes for r in s["rings"])} points')
print('emblem crescent fit: moon r', round(oc[2], 1), 'bite r', round(ic[2], 1), 'offset', round(math.hypot(ic[0] - oc[0], ic[1] - oc[1]), 1))
