"""Static layout check of every content.py against the renderer's geometry (fails loudly)."""
import importlib.util, sys
import cairo
c = cairo.Context(cairo.ImageSurface(cairo.FORMAT_ARGB32, 10, 10))
def w(fam, size, s, sp=0):
    c.select_font_face(fam, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL); c.set_font_size(size)
    return sum(c.text_extents(ch).x_advance for ch in s) + sp * (len(s) - 1) if sp else c.text_extents(s).x_advance
def wrap(s, fam, size, maxw):
    out, cur = [], ""
    for word in s.split():
        t = (cur + " " + word).strip()
        if cur and w(fam, size, t) > maxw: out.append(cur); cur = word
        else: cur = t
    return out + [cur]
bad = 0
for v in sys.argv[1:]:
    spec = importlib.util.spec_from_file_location("c", f"{v}/content.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    for line in m.HOOK_TITLE:
        tw_ = w("VOrbitron Black", 100, line, 4)
        if tw_ > 1000: print(f"{v} HOOK '{line}' too wide {tw_:.0f}"); bad += 1
    for i, t in enumerate(m.TIPS):
        cat_end = 132 + w("VOrbitron Bold", 44, t["cat"], 2)
        px0 = 984 - w("VOrbitron Bold", 26, t["tag"], 1) - 36
        lines = wrap(t["head"], "VExo2 Black", 68, 790)
        fs, sp = 40, 3.0
        while w("VShareTech", fs, t["term"], sp) > 790 and fs > 28:
            if sp > 1: sp -= 0.5
            else: fs -= 1
        chip_head = w("VExo2 Bold", 34, t["head"])
        probs = []
        if cat_end > px0 - 18: probs.append(f"cat/tag collide ({cat_end:.0f} vs {px0:.0f})")
        if len(lines) > 2: probs.append(f"headline {len(lines)} lines")
        if fs < 34: probs.append(f"terminal shrinks to {fs}px")
        if chip_head > 600: probs.append(f"chip headline {chip_head:.0f}px > 600")
        print(f"{v} tip{i+1} {t['cat']:<13} lines={len(lines)} term={fs}px/{sp} cat_end={cat_end:.0f} tag_x0={px0:.0f} chip={chip_head:.0f} {'OK' if not probs else 'PROBLEM: ' + '; '.join(probs)}")
        bad += bool(probs)
print("TOTAL PROBLEMS:", bad)
