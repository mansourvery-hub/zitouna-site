#!/usr/bin/env python3
"""Build the Zitouna site: python3 build.py   (needs Python 3.9+; Pillow only for og.png)"""
import json, re, shutil, sys, zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent; SRC = ROOT / "src"; DIST = ROOT / "dist"
cfg = json.loads((ROOT / "site.config.json").read_text())
cfg["SITE"] = cfg["SITE"].rstrip("/")
# Compute base path for GitHub Pages project sites (e.g., "/zitouna-site" from "https://user.github.io/repo")
parsed = urlparse(cfg["SITE"])
BASE_PATH = parsed.path if parsed.path != "/" else ""
warn = []

# 1. substitute config; empty or placeholder values remove their footer lines entirely
def sub(text):
    for k, v in cfg.items():
        if not v and k in ("DOWNLOAD_URL", "SUPPORT_URL"): v = "#"; warn.append(f"{k} not set: links point to '#'")
        if not v and k in ("OPERATOR", "CONTACT"): v = ""  # empty string removes the line
        text = text.replace("{{%s}}" % k, v)
    # Remove footer lines that were emptied (empty or placeholder text)
    text = re.sub(r'<p>&copy; \s*\[operator to be supplied\]\. Zitouna is an independent app\.</p>\s*', '', text)
    text = re.sub(r'<p>&copy; \s*\.[ ]*Zitouna is an independent app\.</p>\s*', '', text)
    text = re.sub(r'<p>Contact: \s*\[contact to be supplied\]\. <a href="[^"]*">Support Zitouna</a>\.</p>\s*', '', text)
    text = re.sub(r'<p>Contact: \s*\.\s*<a href="[^"]*">Support Zitouna</a>\.</p>\s*', '', text)
    return text
if cfg["SITE"] == "https://example.com": warn.append("SITE is still example.com: canonical, sitemap and social URLs are wrong")

def prefix(path: str) -> str:
    """Prefix asset path with BASE_PATH for GitHub Pages subpath."""
    if not BASE_PATH or path.startswith(("http:", "https:", "//", "data:")):
        return path
    if path.startswith("/"):
        return BASE_PATH + path
    return BASE_PATH + "/" + path

# 2. fonts: only emit @font-face for files that exist (self-hosted, no third-party requests)
# Note: Manrope uses static weights (Regular 400, Bold 700) since variable font not available
FONTS = [
    ("Zilla Slab", 500, "ZillaSlab-Medium.woff2"),
    ("Zilla Slab", 700, "ZillaSlab-Bold.woff2"),
    ("Manrope", 400, "Manrope-Regular.woff2"),
    ("Manrope", 700, "Manrope-Bold.woff2"),
]
faces = [f"@font-face{{font-family:'{n}';font-weight:{w};font-display:swap;src:url({prefix('/fonts/' + f)}) format('woff2')}}" for n, w, f in FONTS if (SRC / "fonts" / f).exists()]
for n, w, f in FONTS:
    if not (SRC / "fonts" / f).exists(): warn.append(f"font file missing: src/fonts/{f} (system fallback used)")

if DIST.exists(): shutil.rmtree(DIST)
(DIST / "fonts").mkdir(parents=True)
for f in (SRC / "fonts").glob("*.woff2"): shutil.copy(f, DIST / "fonts" / f.name)
# Disable Jekyll on GitHub Pages
(DIST / ".nojekyll").write_text("")
html = sub((SRC / "index.html").read_text()).replace("{{FONTS_LINK}}", f'<link rel="stylesheet" href="{prefix("/fonts.css")}">\n' if faces else "")
# Prefix all asset paths in HTML (href/src starting with / but not already prefixed)
def prefix_asset(match):
    path = match.group(2)
    if path.startswith(BASE_PATH + "/"):
        return match.group(0)  # Already prefixed
    return match.group(1) + '="' + prefix(path) + '"'
html = re.sub(r'(href|src)="(/[^"]*)"', prefix_asset, html)
(DIST / "index.html").write_text(html)
if faces: (DIST / "fonts.css").write_text("\n".join(faces))
css = re.sub(r"\s+", " ", re.sub(r"/\*.*?\*/", "", (SRC / "styles.css").read_text(), flags=re.S))
(DIST / "styles.css").write_text(css)
for f in ("main.js", "logic.js", "gauge.js", "demo.js", "demo.css", "demo-tokens.css", "app-ui.js", "favicon.png"): shutil.copy(SRC / f, DIST / f)
_probe = SRC / "_probe"
if _probe.exists():
    (DIST / "_probe").mkdir(parents=True, exist_ok=True)
    for f in _probe.glob("*"): shutil.copy(f, DIST / "_probe" / f.name)


# For GitHub Pages subpath, ensure assets at BASE_PATH (dist/BASE_PATH.lstrip("/"))
# Since GitHub Pages serves dist/ at BASE_PATH, /BASE_PATH/... maps to dist/BASE_PATH.lstrip("/")/
if BASE_PATH:
    base_dir = DIST / BASE_PATH.lstrip("/")
    (base_dir / "fonts").mkdir(parents=True, exist_ok=True)
    for f in (SRC / "fonts").glob("*.woff2"): shutil.copy(f, base_dir / "fonts" / f.name)
    for f in ("main.js", "logic.js", "gauge.js", "demo.js", "demo.css", "demo-tokens.css", "app-ui.js", "favicon.png"):
        shutil.copy(SRC / f, base_dir / f)
    # Copy generated/root files (after CSS generation)
    for f in ["styles.css", "fonts.css", "favicon.png", "og.png"]:
        if (DIST / f).exists():
            shutil.copy(DIST / f, base_dir / f)
    # ALSO copy fonts to dist/fonts/ for any absolute /fonts/ refs
    # (HTML should use BASE_PATH prefix, but belt-and-suspenders)
    if not (DIST / "fonts").exists():
        (DIST / "fonts").mkdir(parents=True, exist_ok=True)
    for f in (SRC / "fonts").glob("*.woff2"):
        if not (DIST / "fonts" / f.name).exists():
            shutil.copy(f, DIST / "fonts" / f.name)

# Disable Jekyll on GitHub Pages (also in base_dir if needed)
(DIST / ".nojekyll").write_text("")
if BASE_PATH:
    base_dir = DIST / BASE_PATH.lstrip("/")
    (base_dir / ".nojekyll").write_text("")


# 3. SEO and security files
S = cfg["SITE"]
(DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {S}/sitemap.xml\n")
(DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{S}/</loc></url></urlset>\n')
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
# The Flutter demo is framed by our own page, so its paths must allow it.
# Specific paths first: hosts apply the first matching rule.
# The framed app is our own compiled Dart (same origin), but the Flutter engine needs:
# wasm-unsafe-eval (CanvasKit WASM compile), unsafe-inline styles (engine-injected),
# connect-src 'self' (FontManifest.json, canvaskit.wasm fetch), base-uri 'self'.
# CanvasKit itself is bundled locally (FLUTTER_WEB_CANVASKIT_URL) — no third-party requests.
(DIST / "_headers").write_text(f"""/*
  Content-Security-Policy: {CSP}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
/
  Cache-Control: public, max-age=0, must-revalidate
/*.js
  Cache-Control: public, max-age=3600
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/og.png
  Cache-Control: public, max-age=86400
/*.css
  Cache-Control: public, max-age=3600
""")

(ROOT / "deploy").mkdir(exist_ok=True)
hdr = [l.strip() for l in (DIST / "_headers").read_text().split("/*\n", 1)[1].split("\n/")[0].split("\n") if ":" in l]
(ROOT / "deploy" / "nginx-headers.conf").write_text("# include inside the server {} block\n" + "".join('add_header %s "%s" always;\n' % tuple(x.strip() for x in l.split(": ", 1)) for l in hdr))

# 4. social image 1200x630 from the app's tokens (DejaVu Serif stands in for Zilla Slab)
try:
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("RGB", (1200, 630), "#F5F1E2"); d = ImageDraw.Draw(im)
    for i, c in enumerate(["#6E9B3F", "#C1962A", "#833F5C", "#241B24"]): d.rectangle([780 + i * 105, 0, 885 + i * 105, 630], fill=c)
    fp = next((p for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"] if Path(p).exists()), None)
    big, small = (ImageFont.truetype(fp, 96), ImageFont.truetype(fp, 40)) if fp else (ImageFont.load_default(), ImageFont.load_default())
    d.text((70, 200), "Zitouna", font=big, fill="#3F4B26")
    d.text((70, 340), "Know your olives\nbefore the expert does.", font=small, fill="#242A1B", spacing=14)
    im.save(DIST / "og.png", optimize=True)
except ImportError: warn.append("Pillow missing: og.png not generated")

# 5. verification harness (static checks only: no browser was available)
class P(HTMLParser):
    def __init__(s): super().__init__(); s.ids = set(); s.refs = []; s.h1 = 0; s.imgs = 0; s.ld = False; s.ldtxt = ""; s.hs = []; s.nm = []; s.names = []
    def handle_starttag(s, t, a):
        a = dict(a)
        if "id" in a: s.ids.add(a["id"])
        if t == "h1": s.h1 += 1
        if len(t) == 2 and t[0] == "h" and t[1].isdigit(): s.hs.append(int(t[1]))
        if t in ("a", "button") and not a.get("class", "").startswith("skip") or t in ("a", "button"): s.nm.append([a.get("aria-label", ""), ""])
        if t == "img" and "alt" not in a: s.imgs += 1
        for k in ("href", "src"):
            if k in a and t != "meta" and a.get("rel") != "canonical":
                # Allow external hrefs on anchor tags (navigation), block external resource loads
                if k == "href" and t == "a":
                    pass  # navigation links are fine
                else:
                    s.refs.append(a[k])
        if "style" in a: warn.append(f"inline style on <{t}> (blocked by CSP)")
        if t == "script" and a.get("type") == "application/ld+json": s.ld = True
    def handle_data(s, x):
        if s.ld: s.ldtxt += x
        if s.nm: s.nm[-1][1] += x.strip()
    def handle_endtag(s, t):
        if t == "script": s.ld = False
        if t in ("a", "button") and s.nm: s.names.append(s.nm.pop())
p = P(); p.feed(html); errs = []
for r in p.refs:
    if r.startswith("#"):
        if r != "#" and r[1:] not in p.ids: errs.append(f"broken anchor {r}")
    elif r.startswith(("http:", "https:", "//")): errs.append(f"external request {r}")
    elif not (DIST / r.lstrip("/")).exists(): errs.append(f"missing file {r}")
if p.h1 != 1: errs.append(f"expected 1 h1, found {p.h1}")
if p.imgs: errs.append("img without alt")
if any(b - a > 1 for a, b in zip(p.hs, p.hs[1:])): errs.append(f"heading levels skip: {p.hs}")
if any(not (a or t) for a, t in p.names): errs.append("link or button without an accessible name")
if 'lang="en"' not in html: errs.append("missing lang")
try: json.loads(p.ldtxt)
except Exception as e: errs.append(f"JSON-LD invalid: {e}")
js = "".join((SRC / n).read_text() for n in ("main.js", "logic.js"))
for bad in ("document.cookie", "localStorage", "sessionStorage", "fetch(", "XMLHttpRequest", "sendBeacon"):
    if bad in js: errs.append(f"JS uses {bad}")
print("Warnings:", *warn, sep="\n  - ") if warn else print("No warnings")
print("Errors:", *errs, sep="\n  - ") if errs else print("Static checks passed (no browser rendering was tested)")

# 6. zips: dist is the deployable; source is the project
def z(name, base, files):
    with zipfile.ZipFile(ROOT / name, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files: zf.write(f, f.relative_to(base))
z("zitouna-dist.zip", DIST, [f for f in DIST.rglob("*") if f.is_file()])
z("zitouna-source.zip", ROOT, [f for f in ROOT.rglob("*") if f.is_file() and "dist" not in f.parts and f.suffix != ".zip"])
sys.exit(1 if errs else 0)