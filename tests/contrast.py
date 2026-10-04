#!/usr/bin/env python3
"""WCAG contrast check for the site's real colour pairs (light and dark). Exit 1 on failure.
Text needs 4.5:1, large text and UI parts 3:1. Alpha is blended over the background."""
import sys
def rgb(h): h = h.lstrip("#"); return [int(h[i:i+2], 16) for i in (0, 2, 4)]
def lum(c):
    f = lambda v: (v/255)/12.92 if v/255 <= .03928 else (((v/255)+.055)/1.055)**2.4
    r, g, b = map(f, c); return .2126*r + .7152*g + .0722*b
def ratio(fg, bg, a=1.0):
    f = [a*x + (1-a)*y for x, y in zip(rgb(fg), rgb(bg))]
    L1, L2 = sorted([lum(f), lum(rgb(bg))], reverse=True); return (L1+.05)/(L2+.05)
T = {  # from lib/theme/zitouna_theme.dart (dark page/panel values as used in styles.css and demo.css)
 "light": dict(paper="#F5F1E2", raised="#FFFEF9", sunken="#EAE2C8", ink="#242A1B", soft="#6C7058", olive="#3F4B26", c0="#6E9B3F", c1="#C1962A", c2="#833F5C", c3="#241B24", t0="#E3EEDA", t1="#F4E8CB", t2="#EFDCE4", t3="#E2DDE2"),
 "dark": dict(paper="#191A11", raised="#222418", sunken="#131409", ink="#ECE7D2", soft="#A7AB8C", olive="#A7C078", c0="#8FC25C", c1="#E0B44A", c2="#DC8CAC", c3="#B7ADC0", t0="#232E17", t1="#312713", t2="#37222D", t3="#232028")}
P = {"hero fg0": ("#242A1B", "#F5F1E2"), "stage g": ("#14200A", "#6E9B3F"), "stage y": ("#2A1F05", "#C1962A"), "stage w": ("#FBF7EA", "#833F5C"), "stage k": ("#FBF7EA", "#241B24"), "dark hero": ("#F1EBD6", "#191A11")}
fails = 0
KNOWN = {'[light] gauge soon on card'}  # the app's own token; stage is also given as text
def chk(name, fg, bg, need, a=1.0):
    global fails; r = ratio(fg, bg, a); ok = r >= need; k = (not ok) and name in KNOWN; fails += (not ok) and not k
    print(f"{'ok  ' if ok else ('KNOWN' if k else 'FAIL')} {r:5.2f} (need {need}) {name}")
for n, (fg, bg) in P.items():
    chk(n, fg, bg, 4.5); chk(n + " note text (full strength)", fg, bg, 4.5)
chk("logo Arabic at 75% opacity (paper)", "#242A1B", "#F5F1E2", 4.5, .75); chk("logo Arabic at 75% (dark)", "#F1EBD6", "#191A11", 4.5, .75)
for th, t in T.items():
    for name, fg, bg, need in [("ink on paper", "ink", "paper", 4.5), ("ink on raised", "ink", "raised", 4.5), ("soft on raised", "soft", "raised", 4.5), ("soft on paper", "soft", "paper", 4.5),
        ("tab selected", "paper", "olive", 4.5), ("tab idle", "ink", "sunken", 4.5), ("save button", "paper", "olive", 4.5), ("toast", "paper", "ink", 4.5),
        ("chip early", "CK0", "t0", 4.5), ("chip soon", "CK1", "t1", 4.5), ("chip pick", "CK2", "t2", 4.5), ("chip late", "CK3", "t3", 4.5),
        ("gauge early on card", "c0", "raised", 3), ("gauge soon on card", "c1", "raised", 3), ("gauge pick on card", "c2", "raised", 3), ("gauge late on card", "c3", "raised", 3), ("focus ring ink on sunken", "ink", "sunken", 3)]:
        if fg.startswith("CK"): fg = ("ink" if th == "light" else "c" + fg[2])  # light chips use ink text, dark chips use the stage colour
        chk(f"[{th}] {name}", t[fg], t[bg], need)
print("FAILURES:", fails); sys.exit(1 if fails else 0)
