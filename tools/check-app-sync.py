#!/usr/bin/env python3
"""Check that the site's JS/CSS matches the app's Dart source.

Compares:
- lib/logic/ripeness_calculator.dart vs src/logic.js
- lib/logic/rendement_calculator.dart vs src/logic.js
- lib/widgets/ripeness_arc_gauge.dart vs src/gauge.js
- lib/theme/zitouna_theme.dart vs src/demo.css, tests/contrast.py
- lib/l10n/app_en.arb vs src/demo.js
"""
import json
import re
import sys
from pathlib import Path

APP_ROOT = Path("/home/mohamed/Desktop/Github/Zitouna")
SITE_ROOT = Path(__file__).parent.parent

errors = []
warnings = []

def read_dart(path):
    return (APP_ROOT / path).read_text()

def read_js(path):
    return (SITE_ROOT / path).read_text()

def read_css(path):
    return (SITE_ROOT / path).read_text()

def read_arb(path):
    return json.loads((APP_ROOT / path).read_text())

# 1. lib/logic/ripeness_calculator.dart vs src/logic.js
print("Checking ripeness_calculator.dart vs logic.js...")
dart = read_dart("lib/logic/ripeness_calculator.dart")
js = read_js("src/logic.js")

# Check weights - normalize by removing trailing .0
weight_patterns = [
    ("weightGreen", r"weightGreen\s*=\s*([\d.]+)", r"g:\s*([\d.]+)"),
    ("weightTurning", r"weightTurning\s*=\s*([\d.]+)", r"t:\s*([\d.]+)"),
    ("weightPurple", r"weightPurple\s*=\s*([\d.]+)", r"p:\s*([\d.]+)"),
    ("weightBlack", r"weightBlack\s*=\s*([\d.]+)", r"b:\s*([\d.]+)"),
]
for name, dart_pat, js_pat in weight_patterns:
    dart_match = re.search(dart_pat, dart)
    js_match = re.search(js_pat, js)
    if dart_match and js_match:
        dart_val = float(dart_match.group(1))
        js_val = float(js_match.group(1))
        if abs(dart_val - js_val) > 0.001:
            errors.append(f"Weight mismatch {name}: app={dart_val}, site={js_val}")

# Check Chemlali thresholds
chemlali_dart = re.search(r"case Variety\.chemlali:.*?soon:\s*([\d.]+).*?pickNow:\s*([\d.]+).*?gettingLate:\s*([\d.]+)", dart, re.S)
chemlali_js = re.search(r"CHEMLALI\s*=\s*\{\s*soon:\s*([\d.]+),\s*pickNow:\s*([\d.]+),\s*late:\s*([\d.]+)", js)
if chemlali_dart and chemlali_js:
    for i, name in enumerate(["soon", "pickNow", "gettingLate/late"]):
        dart_val = chemlali_dart.group(i+1)
        js_val = chemlali_js.group(i+1)
        if dart_val != js_val:
            errors.append(f"Chemlali {name} mismatch: app={dart_val}, site={js_val}")

# Check rounding rule
if "toStringAsFixed(2)" not in dart:
    warnings.append("App doesn't use toStringAsFixed(2) for rounding")
if ".toFixed(2)" not in js:
    warnings.append("Site doesn't use toFixed(2) for rounding")

# Check stage order (Too Early=0, Soon=1, Pick Now=2, Getting Late=3)
if "tooEarly" not in dart.lower():
    warnings.append("App stage order may differ")
if "Too Early" not in js:
    warnings.append("Site stage order may differ")

# 2. lib/logic/rendement_calculator.dart vs src/logic.js
print("Checking rendement_calculator.dart vs logic.js...")
dart = read_dart("lib/logic/rendement_calculator.dart")
js = read_js("src/logic.js")

# Oil density
density_dart = re.search(r"oliveOilDensity\s*=\s*([\d.]+)", dart)
density_js = re.search(r"OIL_DENSITY\s*=\s*([\d.]+)", js)
if density_dart and density_js:
    if density_dart.group(1) != density_js.group(1):
        errors.append(f"Oil density mismatch: app={density_dart.group(1)}, site={density_js.group(1)}")

# 3. lib/widgets/ripeness_arc_gauge.dart vs src/gauge.js
print("Checking ripeness_arc_gauge.dart vs gauge.js...")
dart = read_dart("lib/widgets/ripeness_arc_gauge.dart")
js = read_js("src/gauge.js")

# Full gauge - more specific regex to match the GEO object
full_dart = re.search(r"fullViewBox\s*=\s*Size\(([\d.]+),\s*([\d.]+)\)", dart)
full_js = re.search(r"full:\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)", js)
if full_dart and full_js:
    if full_dart.group(1) != full_js.group(1) or full_dart.group(2) != full_js.group(2):
        errors.append(f"Full viewBox mismatch: app={full_dart.group(1)}x{full_dart.group(2)}, site={full_js.group(1)}x{full_js.group(2)}")

# Match full radius, strokeWidth, markerRadius more precisely
full_section = re.search(r"full:\s*\{([^}]+)\}", js)
if full_section:
    full_props = full_section.group(1)
    radius_js = re.search(r"r:\s*(\d+)", full_props)
    sw_js = re.search(r"sw:\s*(\d+)", full_props)
    mr_js = re.search(r"mr:\s*([\d.]+)", full_props)
else:
    radius_js = sw_js = mr_js = None

radius_dart = re.search(r"fullRadius\s*=\s*([\d.]+)", dart)
if radius_dart and radius_js:
    if radius_dart.group(1) != radius_js.group(1):
        errors.append(f"Full radius mismatch: app={radius_dart.group(1)}, site={radius_js.group(1)}")

sw_dart = re.search(r"fullStrokeWidth\s*=\s*([\d.]+)", dart)
if sw_dart and sw_js:
    if sw_dart.group(1) != sw_js.group(1):
        errors.append(f"Full strokeWidth mismatch: app={sw_dart.group(1)}, site={sw_js.group(1)}")

# markerRadius is defined as: static const double fullMarkerRadius = 8.5; or similar
mr_dart = re.search(r"fullMarkerRadius\s*=\s*([\d.]+)", dart)
if not mr_dart:
    mr_dart = re.search(r"markerRadius\s*=\s*mini\s*\?\s*([\d.]+)\s*:\s*([\d.]+)", dart)
if mr_dart and mr_js:
    full_marker = mr_dart.group(2) if mr_dart.lastindex == 2 else mr_dart.group(1)
    if full_marker != mr_js.group(1):
        errors.append(f"Full markerRadius mismatch: app={full_marker}, site={mr_js.group(1)}")

# Mini gauge
mini_dart = re.search(r"miniViewBox\s*=\s*Size\(([\d.]+),\s*([\d.]+)\)", dart)
mini_js = re.search(r"mini:\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)", js)
if mini_dart and mini_js:
    if mini_dart.group(1) != mini_js.group(1) or mini_dart.group(2) != mini_js.group(2):
        errors.append(f"Mini viewBox mismatch: app={mini_dart.group(1)}x{mini_dart.group(2)}, site={mini_js.group(1)}x{mini_js.group(2)}")

mini_section = re.search(r"mini:\s*\{([^}]+)\}", js)
if mini_section:
    mini_props = mini_section.group(1)
    mini_radius_js = re.search(r"r:\s*(\d+)", mini_props)
    mini_sw_js = re.search(r"sw:\s*(\d+)", mini_props)
    mini_mr_js = re.search(r"mr:\s*([\d.]+)", mini_props)
else:
    mini_radius_js = mini_sw_js = mini_mr_js = None

mini_radius_dart = re.search(r"miniRadius\s*=\s*([\d.]+)", dart)
if mini_radius_dart and mini_radius_js:
    if mini_radius_dart.group(1) != mini_radius_js.group(1):
        errors.append(f"Mini radius mismatch: app={mini_radius_dart.group(1)}, site={mini_radius_js.group(1)}")

mini_sw_dart = re.search(r"miniStrokeWidth\s*=\s*([\d.]+)", dart)
if mini_sw_dart and mini_sw_js:
    if mini_sw_dart.group(1) != mini_sw_js.group(1):
        errors.append(f"Mini strokeWidth mismatch: app={mini_sw_dart.group(1)}, site={mini_sw_js.group(1)}")

mini_mr_dart = re.search(r"miniMarkerRadius\s*=\s*([\d.]+)", dart)
if not mini_mr_dart:
    mini_mr_dart = re.search(r"markerRadius\s*=\s*mini\s*\?\s*([\d.]+)", dart)
if mini_mr_dart and mini_mr_js:
    if mini_mr_dart.group(1) != mini_mr_js.group(1):
        errors.append(f"Mini markerRadius mismatch: app={mini_mr_dart.group(1)}, site={mini_mr_js.group(1)}")

# 4. lib/theme/zitouna_theme.dart vs src/demo.css
print("Checking zitouna_theme.dart vs demo.css...")
dart = read_dart("lib/theme/zitouna_theme.dart")
css = read_css("src/demo.css")

# Light theme colors - app uses 8-digit hex (0xAARRGGBB), site uses 6-digit (#RRGGBB)
light_colors = [
    ("paper", r"paper:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--paper:#([A-Fa-f0-9]{6})"),
    ("paperRaised", r"paperRaised:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--raised:#([A-Fa-f0-9]{6})"),
    ("paperSunken", r"paperSunken:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--sunken:#([A-Fa-f0-9]{6})"),
    ("ink", r"ink:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--ink:#([A-Fa-f0-9]{6})"),
    ("olive", r"olive:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--olive:#([A-Fa-f0-9]{6})"),
    ("gold", r"gold:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"var\(--c1\)"),
    ("stageEarly", r"stageEarly:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--c0:#([A-Fa-f0-9]{6})"),
    ("stageSoon", r"stageSoon:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--c1:#([A-Fa-f0-9]{6})"),
    ("stagePick", r"stagePick:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--c2:#([A-Fa-f0-9]{6})"),
    ("stageLate", r"stageLate:\s*Color\(0x[A-Fa-f0-9]{2}([A-Fa-f0-9]{6})\)", r"--c3:#([A-Fa-f0-9]{6})"),
]

light_section = re.search(r"static const ZitounaTheme light = ZitounaTheme\((.*?)\);", dart, re.S)
if light_section:
    light_dart = light_section.group(1)
    for name, dart_pat, css_pat in light_colors:
        dart_match = re.search(dart_pat, light_dart)
        css_match = re.search(css_pat, css)
        if dart_match and css_match:
            dart_val = "#" + dart_match.group(1)
            print(f"  Checking {name}: dart={dart_val}, css_pat={css_pat}, css_match_groups={css_match.groups()}")
            if "var(" in css_pat:
                # CSS variable reference - check the variable exists and resolve it
                var_name = "--c1"  # hardcoded for gold
                var_match = re.search(rf"{re.escape(var_name)}:#([A-Fa-f0-9]{{6}})", css)
                if var_match:
                    css_val = "#" + var_match.group(1)
                    if dart_val.upper() != css_val.upper():
                        errors.append(f"Light {name} mismatch (via {var_name}): app={dart_val}, site={css_val}")
                else:
                    errors.append(f"Light {name} CSS variable {var_name} not found in CSS")
            else:
                # Check if css_match has groups
                if css_match.groups():
                    css_val = "#" + css_match.group(1)
                    if dart_val.upper() != css_val.upper():
                        errors.append(f"Light {name} mismatch: app={dart_val}, site={css_val}")
                else:
                    print(f"  INFO: {name} pattern has no capture group, skipping direct comparison")
        elif dart_match and not css_match:
            print(f"  WARNING: {name} found in Dart but not in CSS (pattern: {css_pat})")
        elif not dart_match and css_match:
            print(f"  WARNING: {name} found in CSS but not in Dart")

# Dark theme colors
dark_section = re.search(r"static const ZitounaTheme dark = ZitounaTheme\((.*?)\);", dart, re.S)
if dark_section:
    dark_dart = dark_section.group(1)
    dark_css_section = re.search(r"@media\(prefers-color-scheme:dark\)\{([^}]+)\}", css)
    if dark_css_section:
        dark_css = dark_css_section.group(1)
        for name, dart_pat, css_pat in light_colors:
            dart_match = re.search(dart_pat, dark_dart)
            css_match = re.search(css_pat, dark_css)
            if dart_match and css_match:
                dart_val = "#" + dart_match.group(1)
                if "var(" in css_pat:
                    var_name = css_match.group(1)
                    var_match = re.search(rf"{re.escape(var_name)}:#([A-Fa-f0-9]{{6}})", css)
                    if var_match:
                        css_val = "#" + var_match.group(1)
                        if dart_val.upper() != css_val.upper():
                            errors.append(f"Dark {name} mismatch (via {var_name}): app={dart_val}, site={css_val}")
                else:
                    css_val = "#" + css_match.group(1)
                    if dart_val.upper() != css_val.upper():
                        errors.append(f"Dark {name} mismatch: app={dart_val}, site={css_val}")

# 5. lib/l10n/app_en.arb vs src/demo.js
print("Checking app_en.arb vs demo.js...")
arb = read_arb("lib/l10n/app_en.arb")
js = read_js("src/demo.js")

strings_to_check = [
    ("checkRipeness", "Check Ripeness"),
    ("saveRipenessCheck", "Save Ripeness Check"),
    ("saveMillLog", "Save Delivery"),
    ("computedRendementLabel", "Extraction Rendement"),
    ("tabOverview", "Overview"),
    ("tabRipeness", "Ripeness"),
    ("tabMill", "Mill"),
    ("stageTooEarly", "Too Early"),
    ("stageSoon", "Soon"),
    ("stagePickNow", "Pick Now"),
    ("stageGettingLate", "Getting Late"),
    ("bucketGreen", "Green"),
    ("bucketTurning", "Turning"),
    ("bucketPurple", "Purple"),
    ("bucketBlack", "Black"),
]

for key, expected in strings_to_check:
    if key not in arb:
        errors.append(f"ARB missing key: {key}")
    elif arb[key] != expected:
        errors.append(f"ARB value mismatch {key}: expected='{expected}', got='{arb[key]}'")
    if expected not in js:
        errors.append(f"JS missing string: '{expected}' (from ARB key {key})")

# Summary
print()
if errors:
    print("ERRORS:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("All checks passed!")
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")