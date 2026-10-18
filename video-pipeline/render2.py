"""Neon 'Claude AI Tips & Tricks' video, synced to timeline.json.

usage: python3 render2.py video out.mp4 mix.wav
       python3 render2.py stills outdir t1 t2 ...
"""
import json
import math
import os
import subprocess
import sys

import cairo
import numpy as np
from scipy.ndimage import gaussian_filter

sys.path.insert(0, os.getcwd())  # per-video content.py lives in the working directory
from content import HOOK_TITLE, TIPS

W, H, FPS = 1080, 1920, 30
PI = math.pi
TL = json.load(open("timeline.json"))
TOTAL = TL["total"]

F_ORB_BLACK, F_ORB_BOLD = "VOrbitron Black", "VOrbitron Bold"
F_HEAD, F_HEAD_B = "VExo2 Black", "VExo2 Bold"
F_MONO = "VShareTech"


def hexc(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


COLS = [hexc(t["color"]) for t in TIPS]
ORANGE = hexc("#FF8A3D")
WHITE = (1, 1, 1)
G_CYAN, G_MID, G_PINK = hexc("#3FE3F5"), hexc("#7C8CFF"), hexc("#D06BF2")


# ------------------------------------------------------------ helpers
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def prog(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def eo3(x):
    return 1 - (1 - x) ** 3


def eio(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def lerp(a, b, u):
    return a + (b - a) * u


def mixc(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


def font(ctx, fam, size):
    ctx.select_font_face(fam, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)


def tw(ctx, s, spacing=0):
    if not s:
        return 0
    if not spacing:
        return ctx.text_extents(s).x_advance
    return sum(ctx.text_extents(c).x_advance for c in s) + spacing * (len(s) - 1)


def text(ctx, s, x, y, fam, size, color, alpha=1.0, spacing=0, align="left"):
    font(ctx, fam, size)
    w = tw(ctx, s, spacing)
    if align == "center":
        x -= w / 2
    ctx.set_source_rgba(*color, alpha)
    if not spacing:
        ctx.move_to(x, y)
        ctx.show_text(s)
    else:
        for ch in s:
            ctx.move_to(x, y)
            ctx.show_text(ch)
            x += ctx.text_extents(ch).x_advance + spacing
    ctx.new_path()
    return w


def wrap(ctx, s, fam, size, maxw):
    font(ctx, fam, size)
    out, cur = [], ""
    for w in s.split():
        tst = (cur + " " + w).strip()
        if cur and tw(ctx, tst) > maxw:
            out.append(cur)
            cur = w
        else:
            cur = tst
    out.append(cur)
    return out


def hud_path(ctx, x0, y0, x1, y1, c=26):
    """Chamfered HUD panel like the original cards."""
    tab = min(70, (x1 - x0) * 0.08)
    ctx.new_path()
    ctx.move_to(x0 + c, y0)
    ctx.line_to(x1 - tab - c * 0.6, y0)
    ctx.line_to(x1 - tab + c * 0.2, y0 + c * 0.8)
    ctx.line_to(x1, y0 + c * 0.8)
    ctx.line_to(x1, y1 - c)
    ctx.line_to(x1 - c, y1)
    ctx.line_to(x0 + tab + c, y1)
    ctx.line_to(x0 + tab, y1 - c * 0.9)
    ctx.line_to(x0, y1 - c * 0.9)
    ctx.line_to(x0, y0 + c)
    ctx.close_path()


def chip_path(ctx, x0, y0, x1, y1, c=20):
    ctx.new_path()
    ctx.move_to(x0 + c, y0)
    ctx.line_to(x1 - 3 * c, y0)
    ctx.line_to(x1 - 2 * c, y0 + c * 0.7)
    ctx.line_to(x1, y0 + c * 0.7)
    ctx.line_to(x1, y1 - c)
    ctx.line_to(x1 - c, y1)
    ctx.line_to(x0 + c, y1)
    ctx.line_to(x0, y1 - c)
    ctx.line_to(x0, y0 + c)
    ctx.close_path()


# ------------------------------------------------------------ icons (drawn ~130px box around 0,0)
def icon(ctx, kind, cx, cy, s, color, alpha, lw=7):
    if alpha <= 0:
        return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    ctx.set_line_width(lw)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.set_source_rgba(*color, alpha)
    ctx.new_path()
    if kind == "docs":
        # back sheet
        ctx.move_to(-30, -48)
        ctx.line_to(-30, -62)
        ctx.line_to(40, -62)
        ctx.line_to(58, -44)
        ctx.line_to(58, 40)
        ctx.line_to(46, 40)
        ctx.stroke()
        # front sheet with folded corner
        ctx.move_to(-52, -46)
        ctx.line_to(14, -46)
        ctx.line_to(36, -24)
        ctx.line_to(36, 62)
        ctx.line_to(-52, 62)
        ctx.close_path()
        ctx.stroke()
        ctx.move_to(14, -46)
        ctx.line_to(14, -24)
        ctx.line_to(36, -24)
        ctx.stroke()
        for y in (-6, 16, 38):
            ctx.move_to(-34, y)
            ctx.line_to(18 if y < 38 else 0, y)
        ctx.stroke()
    elif kind == "bulb":
        ctx.arc(0, -14, 40, math.radians(140), math.radians(40))
        ctx.line_to(18, 30)
        ctx.line_to(-18, 30)
        ctx.close_path()
        ctx.stroke()
        for y in (44, 58):
            ctx.move_to(-16, y)
            ctx.line_to(16, y)
        ctx.stroke()
        ctx.move_to(-8, 30)
        ctx.line_to(-8, 0)
        ctx.line_to(0, -10)
        ctx.line_to(8, 0)
        ctx.line_to(8, 30)
        ctx.stroke()
        for ang in (-150, -110, -70, -30):
            a = math.radians(ang)
            ctx.move_to(56 * math.cos(a), -14 + 56 * math.sin(a))
            ctx.line_to(70 * math.cos(a), -14 + 70 * math.sin(a))
        ctx.stroke()
    elif kind == "folder":
        ctx.move_to(-62, -40)
        ctx.line_to(-20, -40)
        ctx.line_to(-6, -26)
        ctx.line_to(62, -26)
        ctx.line_to(62, 50)
        ctx.line_to(-62, 50)
        ctx.close_path()
        ctx.stroke()
        ctx.move_to(-62, -10)
        ctx.line_to(62, -10)
        ctx.stroke()
        ctx.move_to(-40, 26)
        ctx.line_to(-10, 26)
        ctx.stroke()
    elif kind == "code":
        r = 12
        x0, y0, x1, y1 = -64, -50, 64, 50
        ctx.new_sub_path()
        ctx.arc(x1 - r, y0 + r, r, -PI / 2, 0)
        ctx.arc(x1 - r, y1 - r, r, 0, PI / 2)
        ctx.arc(x0 + r, y1 - r, r, PI / 2, PI)
        ctx.arc(x0 + r, y0 + r, r, PI, 1.5 * PI)
        ctx.close_path()
        ctx.stroke()
        ctx.move_to(x0, -28)
        ctx.line_to(x1, -28)
        ctx.stroke()
        ctx.move_to(-22, -6)
        ctx.line_to(-40, 12)
        ctx.line_to(-22, 30)
        ctx.move_to(22, -6)
        ctx.line_to(40, 12)
        ctx.line_to(22, 30)
        ctx.move_to(8, -10)
        ctx.line_to(-8, 34)
        ctx.stroke()
        for k in range(3):
            ctx.arc(-48 + k * 14, -39, 2.5, 0, 2 * PI)
            ctx.fill()
    elif kind == "dash":
        r = 12
        x0, y0, x1, y1 = -64, -50, 64, 50
        ctx.new_sub_path()
        ctx.arc(x1 - r, y0 + r, r, -PI / 2, 0)
        ctx.arc(x1 - r, y1 - r, r, 0, PI / 2)
        ctx.arc(x0 + r, y1 - r, r, PI / 2, PI)
        ctx.arc(x0 + r, y0 + r, r, PI, 1.5 * PI)
        ctx.close_path()
        ctx.stroke()
        for bx, bh in ((-42, 26), (-24, 46), (-6, 34)):
            ctx.move_to(bx, 34)
            ctx.line_to(bx, 34 - bh)
        ctx.stroke()
        ctx.arc(32, 14, 22, PI, 2 * PI)
        ctx.stroke()
        ctx.move_to(32, 14)
        ctx.line_to(44, -2)
        ctx.stroke()
        ctx.move_to(-46, -30)
        ctx.line_to(4, -30)
        ctx.stroke()
    elif kind == "motion":
        ctx.arc(14, 0, 46, 0, 2 * PI)
        ctx.stroke()
        ctx.move_to(0, -22)
        ctx.line_to(32, 0)
        ctx.line_to(0, 22)
        ctx.close_path()
        ctx.stroke()
        for y, x0 in ((-24, -66), (0, -74), (24, -66)):
            ctx.move_to(x0, y)
            ctx.line_to(-44, y)
        ctx.stroke()
    elif kind == "doc":
        ctx.move_to(-46, -62)
        ctx.line_to(20, -62)
        ctx.line_to(46, -36)
        ctx.line_to(46, 62)
        ctx.line_to(-46, 62)
        ctx.close_path()
        ctx.stroke()
        ctx.move_to(20, -62)
        ctx.line_to(20, -36)
        ctx.line_to(46, -36)
        ctx.stroke()
        for y, x1 in ((-30, 0), (-8, 26), (14, 26), (36, 10)):
            ctx.move_to(-26, y)
            ctx.line_to(x1, y)
        ctx.stroke()
    elif kind == "slides":
        ctx.rectangle(-66, -54, 132, 84)
        ctx.stroke()
        ctx.move_to(0, 30)
        ctx.line_to(0, 46)
        ctx.move_to(-24, 62)
        ctx.line_to(0, 46)
        ctx.line_to(24, 62)
        ctx.stroke()
        ctx.move_to(-22, -12)
        ctx.arc(-22, -12, 24, -PI / 2, PI)
        ctx.close_path()
        ctx.stroke()
        for y, x1 in ((-28, 46), (-12, 46), (4, 32)):
            ctx.move_to(14, y)
            ctx.line_to(x1, y)
        ctx.stroke()
    elif kind == "design":
        ctx.rectangle(-60, -6, 62, 62)
        ctx.stroke()
        ctx.arc(20, -18, 38, 0, 2 * PI)
        ctx.stroke()
        for (sx, sy) in ((-44, -44),):
            ctx.move_to(sx, sy - 16)
            ctx.line_to(sx + 4, sy - 4)
            ctx.line_to(sx + 16, sy)
            ctx.line_to(sx + 4, sy + 4)
            ctx.line_to(sx, sy + 16)
            ctx.line_to(sx - 4, sy + 4)
            ctx.line_to(sx - 16, sy)
            ctx.line_to(sx - 4, sy - 4)
            ctx.close_path()
            ctx.fill()
    elif kind == "tags":
        ctx.move_to(-30, -40)
        ctx.line_to(-64, 0)
        ctx.line_to(-30, 40)
        ctx.move_to(30, -40)
        ctx.line_to(64, 0)
        ctx.line_to(30, 40)
        ctx.move_to(14, -52)
        ctx.line_to(-14, 52)
        ctx.stroke()
    elif kind == "order":
        ctx.rectangle(-42, -64, 84, 58)
        ctx.stroke()
        for y in (-48, -34, -20):
            ctx.move_to(-26, y)
            ctx.line_to(26, y)
        ctx.stroke()
        ctx.move_to(0, 2)
        ctx.line_to(0, 24)
        ctx.move_to(-11, 14)
        ctx.line_to(0, 26)
        ctx.line_to(11, 14)
        ctx.stroke()
        ctx.arc(0, 48, 17, 0, 2 * PI)
        ctx.stroke()
        font(ctx, F_ORB_BLACK, 24)
        w = tw(ctx, "?")
        ctx.move_to(-w / 2, 57)
        ctx.show_text("?")
        ctx.new_path()
    elif kind == "info":
        ctx.arc(0, 0, 58, 0, 2 * PI)
        ctx.stroke()
        ctx.arc(0, -28, 6, 0, 2 * PI)
        ctx.fill()
        ctx.move_to(0, -8)
        ctx.line_to(0, 32)
        ctx.stroke()
    elif kind == "check":
        ctx.arc(0, 0, 58, 0, 2 * PI)
        ctx.stroke()
        ctx.move_to(-28, 2)
        ctx.line_to(-8, 22)
        ctx.line_to(28, -18)
        ctx.stroke()
    elif kind == "door":
        ctx.rectangle(-50, -62, 64, 124)
        ctx.stroke()
        ctx.arc(2, 2, 5, 0, 2 * PI)
        ctx.fill()
        ctx.move_to(-6, 0)
        ctx.line_to(60, 0)
        ctx.move_to(44, -16)
        ctx.line_to(62, 0)
        ctx.line_to(44, 16)
        ctx.stroke()
    elif kind == "quote":
        for x in (-30, 26):
            ctx.arc(x, -10, 17, 0, 2 * PI)
            ctx.fill()
            ctx.move_to(x + 15, -4)
            ctx.curve_to(x + 14, 22, x + 2, 36, x - 14, 42)
            ctx.stroke()
    elif kind == "verify":
        ctx.arc(-12, -12, 40, 0, 2 * PI)
        ctx.stroke()
        ctx.set_line_width(lw * 1.5)
        ctx.move_to(18, 18)
        ctx.line_to(52, 52)
        ctx.stroke()
        ctx.set_line_width(lw)
        ctx.move_to(-30, -12)
        ctx.line_to(-17, 1)
        ctx.line_to(6, -24)
        ctx.stroke()
    elif kind == "layers":
        for k3, (x, y) in enumerate(((-56, -54), (-40, -32), (-24, -10))):
            ctx.rectangle(x, y, 82, 60)
            if k3 < 2:
                ctx.stroke()
            else:
                ctx.save()
                ctx.set_source_rgba(*color, alpha * 0.25)
                ctx.fill_preserve()
                ctx.restore()
                ctx.stroke()
    elif kind == "people":
        for (x, y, r1) in ((-26, -22, 18), (28, -30, 15)):
            ctx.arc(x, y, r1, 0, 2 * PI)
            ctx.stroke()
            ctx.arc(x, y + r1 + 44, r1 * 2.1, math.radians(200), math.radians(340))
            ctx.stroke()
    elif kind == "table":
        ctx.rectangle(-62, -46, 124, 92)
        ctx.stroke()
        ctx.move_to(-62, -16)
        ctx.line_to(62, -16)
        ctx.move_to(-62, 15)
        ctx.line_to(62, 15)
        ctx.move_to(-20, -46)
        ctx.line_to(-20, 46)
        ctx.move_to(21, -46)
        ctx.line_to(21, 46)
        ctx.stroke()
    elif kind == "edit":
        ctx.save()
        ctx.rotate(math.radians(-45))
        ctx.rectangle(-14, -50, 28, 78)
        ctx.move_to(-14, 28)
        ctx.line_to(0, 52)
        ctx.line_to(14, 28)
        ctx.move_to(-14, -32)
        ctx.line_to(14, -32)
        ctx.restore()
        ctx.stroke()
        ctx.move_to(-56, 58)
        ctx.line_to(56, 58)
        ctx.stroke()
    elif kind == "style":
        font(ctx, F_HEAD, 104)
        w = tw(ctx, "Aa")
        ctx.move_to(-w / 2, 36)
        ctx.text_path("Aa")
        ctx.fill()
        ctx.move_to(-60, 58)
        ctx.line_to(60, 58)
        ctx.stroke()
    elif kind == "sliders":
        for y, kx in ((-36, 22), (0, -24), (36, 8)):
            ctx.move_to(-60, y)
            ctx.line_to(60, y)
            ctx.stroke()
            ctx.arc(kx, y, 12, 0, 2 * PI)
            ctx.save()
            ctx.set_source_rgba(0.06, 0.04, 0.16, alpha)
            ctx.fill_preserve()
            ctx.restore()
            ctx.stroke()
    elif kind == "history":
        ctx.arc(0, 0, 54, math.radians(-150), math.radians(190))
        ctx.stroke()
        ax, ay = 54 * math.cos(math.radians(-150)), 54 * math.sin(math.radians(-150))
        ctx.move_to(ax - 4, ay - 22)
        ctx.line_to(ax, ay)
        ctx.line_to(ax + 22, ay + 2)
        ctx.stroke()
        ctx.move_to(0, -30)
        ctx.line_to(0, 0)
        ctx.line_to(24, 14)
        ctx.stroke()
    elif kind == "globe":
        ctx.arc(0, 0, 58, 0, 2 * PI)
        ctx.stroke()
        ctx.save()
        ctx.scale(0.45, 1)
        ctx.arc(0, 0, 58, 0, 2 * PI)
        ctx.restore()
        ctx.stroke()
        for y in (-28, 0, 28):
            hw = math.sqrt(58 ** 2 - y ** 2)
            ctx.move_to(-hw, y)
            ctx.line_to(hw, y)
        ctx.stroke()
    elif kind == "image":
        ctx.rectangle(-62, -48, 124, 96)
        ctx.stroke()
        ctx.move_to(-50, 36)
        ctx.line_to(-16, -4)
        ctx.line_to(8, 20)
        ctx.line_to(26, 4)
        ctx.line_to(52, 36)
        ctx.stroke()
        ctx.arc(30, -22, 10, 0, 2 * PI)
        ctx.fill()
    elif kind == "plug":
        ctx.rectangle(-26, -22, 52, 42)
        ctx.stroke()
        for x in (-11, 11):
            ctx.move_to(x, -22)
            ctx.line_to(x, -50)
        ctx.stroke()
        ctx.move_to(0, 20)
        ctx.curve_to(0, 52, 40, 30, 52, 62)
        ctx.stroke()
    elif kind == "mic":
        ctx.new_sub_path()
        ctx.arc(0, -40, 22, PI, 2 * PI)
        ctx.arc(0, 4, 22, 0, PI)
        ctx.close_path()
        ctx.stroke()
        ctx.arc(0, -4, 42, math.radians(10), math.radians(170))
        ctx.stroke()
        ctx.move_to(0, 38)
        ctx.line_to(0, 58)
        ctx.move_to(-24, 58)
        ctx.line_to(24, 58)
        ctx.stroke()
    elif kind == "browser":
        ctx.rectangle(-64, -50, 128, 100)
        ctx.stroke()
        ctx.move_to(-64, -26)
        ctx.line_to(64, -26)
        ctx.stroke()
        for k3 in range(3):
            ctx.arc(-50 + k3 * 13, -38, 3, 0, 2 * PI)
            ctx.fill()
        ctx.move_to(-4, -8)
        ctx.line_to(-4, 34)
        ctx.line_to(6, 24)
        ctx.line_to(14, 40)
        ctx.line_to(20, 37)
        ctx.line_to(12, 21)
        ctx.line_to(26, 20)
        ctx.close_path()
        ctx.fill()
    elif kind == "chain":
        for (cx2, cy2) in ((-20, 16), (20, -16)):
            ctx.save()
            ctx.translate(cx2, cy2)
            ctx.rotate(math.radians(-40))
            r2, w2, h2 = 18, 78, 36
            ctx.new_sub_path()
            ctx.arc(w2 / 2 - r2, -h2 / 2 + r2, r2, -PI / 2, PI / 2)
            ctx.arc(-w2 / 2 + r2, h2 / 2 - r2, r2, PI / 2, 1.5 * PI)
            ctx.close_path()
            ctx.restore()
            ctx.stroke()
    elif kind == "magnifier":
        ctx.arc(-12, -12, 42, 0, 2 * PI)
        ctx.stroke()
        ctx.set_line_width(lw * 1.5)
        ctx.move_to(20, 20)
        ctx.line_to(54, 54)
        ctx.stroke()
        ctx.set_line_width(lw)
    elif kind == "book":
        for sgn in (-1, 1):
            ctx.move_to(0, -40)
            ctx.curve_to(sgn * 20, -52, sgn * 44, -52, sgn * 62, -44)
            ctx.line_to(sgn * 62, 42)
            ctx.curve_to(sgn * 44, 34, sgn * 20, 34, 0, 48)
        ctx.move_to(0, -40)
        ctx.line_to(0, 48)
        ctx.stroke()
    elif kind == "terminal":
        ctx.rectangle(-64, -48, 128, 96)
        ctx.stroke()
        ctx.move_to(-40, -14)
        ctx.line_to(-18, 4)
        ctx.line_to(-40, 22)
        ctx.move_to(-6, 26)
        ctx.line_to(30, 26)
        ctx.stroke()
    elif kind == "keyboard":
        ctx.rectangle(-66, -36, 132, 72)
        ctx.stroke()
        for row, y in enumerate((-20, -2)):
            for k3 in range(6):
                ctx.rectangle(-54 + k3 * 19 + row * 6, y, 11, 10)
        ctx.fill()
        ctx.rectangle(-32, 18, 64, 8)
        ctx.fill()
    elif kind == "spark":
        for sc2, (dx, dy) in ((1.0, (-8, 8)), (0.45, (40, -40))):
            ctx.save()
            ctx.translate(dx, dy)
            ctx.scale(sc2, sc2)
            ctx.move_to(0, -56)
            ctx.curve_to(6, -10, 10, -6, 56, 0)
            ctx.curve_to(10, 6, 6, 10, 0, 56)
            ctx.curve_to(-6, 10, -10, 6, -56, 0)
            ctx.curve_to(-10, -6, -6, -10, 0, -56)
            ctx.close_path()
            ctx.restore()
            ctx.stroke()
    elif kind == "ghost":
        ctx.move_to(-46, 58)
        ctx.line_to(-46, -10)
        ctx.arc(0, -10, 46, PI, 2 * PI)
        ctx.line_to(46, 58)
        for k3 in range(3):
            x0 = 46 - k3 * 31
            ctx.line_to(x0 - 15, 44)
            ctx.line_to(x0 - 31, 58)
        ctx.close_path()
        ctx.stroke()
        for ex in (-16, 16):
            ctx.arc(ex, -12, 7, 0, 2 * PI)
            ctx.fill()
    elif kind == "wave":
        ctx.save()
        ctx.set_line_width(lw * 1.6)
        for x, hgt in ((-48, 0.35), (-24, 0.7), (0, 1.0), (24, 0.7), (48, 0.35)):
            ctx.move_to(x, -54 * hgt)
            ctx.line_to(x, 54 * hgt)
        ctx.stroke()
        ctx.restore()
    elif kind == "cap":
        ctx.move_to(0, -44)
        ctx.line_to(66, -16)
        ctx.line_to(0, 12)
        ctx.line_to(-66, -16)
        ctx.close_path()
        ctx.stroke()
        ctx.move_to(-38, -2)
        ctx.line_to(-38, 30)
        ctx.curve_to(-20, 48, 20, 48, 38, 30)
        ctx.line_to(38, -2)
        ctx.stroke()
        ctx.move_to(60, -14)
        ctx.line_to(60, 30)
        ctx.stroke()
    elif kind == "cards":
        ctx.save()
        ctx.rotate(math.radians(-10))
        ctx.rectangle(-58, -40, 84, 100)
        ctx.restore()
        ctx.stroke()
        ctx.rectangle(-30, -56, 84, 108)
        ctx.save()
        ctx.set_source_rgba(0.06, 0.04, 0.16, alpha)
        ctx.fill_preserve()
        ctx.restore()
        ctx.stroke()
        font(ctx, F_ORB_BLACK, 56)
        w = tw(ctx, "?")
        ctx.move_to(12 - w / 2, 18)
        ctx.show_text("?")
        ctx.new_path()
    elif kind == "calendar":
        ctx.rectangle(-58, -44, 116, 100)
        ctx.stroke()
        ctx.move_to(-58, -18)
        ctx.line_to(58, -18)
        for x in (-30, 30):
            ctx.move_to(x, -58)
            ctx.line_to(x, -32)
        ctx.stroke()
        for r3 in range(2):
            for c3 in range(3):
                ctx.rectangle(-38 + c3 * 28, -4 + r3 * 26, 16, 14)
        ctx.fill()
    elif kind == "target":
        for r3 in (58, 36, 14):
            ctx.arc(0, 0, r3, 0, 2 * PI)
            ctx.stroke()
        ctx.arc(0, 0, 5, 0, 2 * PI)
        ctx.fill()
    elif kind == "checklist":
        for k3, y in enumerate((-40, 0, 40)):
            ctx.rectangle(-60, y - 13, 26, 26)
            ctx.stroke()
            ctx.move_to(-16, y)
            ctx.line_to(60, y)
            ctx.stroke()
            if k3 < 2:
                ctx.move_to(-55, y)
                ctx.line_to(-48, y + 8)
                ctx.line_to(-36, y - 9)
                ctx.stroke()
    elif kind == "diff":
        ctx.rectangle(-60, -56, 120, 112)
        ctx.stroke()
        rows3 = ((-30, "+"), (0, "-"), (30, "+"))
        for y, sign in rows3:
            ctx.move_to(-40, y)
            ctx.line_to(-24, y)
            if sign == "+":
                ctx.move_to(-32, y - 8)
                ctx.line_to(-32, y + 8)
            ctx.move_to(-10, y)
            ctx.line_to(42, y)
        ctx.stroke()
    elif kind == "translate":
        ctx.rectangle(-64, -54, 74, 64)
        ctx.stroke()
        ctx.rectangle(-8, -10, 74, 64)
        ctx.save()
        ctx.set_source_rgba(0.06, 0.04, 0.16, alpha)
        ctx.fill_preserve()
        ctx.restore()
        ctx.stroke()
        font(ctx, F_HEAD, 46)
        w = tw(ctx, "A")
        ctx.move_to(-27 - w / 2, -6)
        ctx.show_text("A")
        ctx.select_font_face("WenQuanYi Zen Hei", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(44)
        w = ctx.text_extents("文").x_advance
        ctx.move_to(29 - w / 2, 38)
        ctx.show_text("文")
        ctx.new_path()
    elif kind == "share":
        pts3 = ((40, -40), (-40, 0), (40, 40))
        ctx.move_to(*pts3[0])
        ctx.line_to(*pts3[1])
        ctx.line_to(*pts3[2])
        ctx.stroke()
        for (x, y) in pts3:
            ctx.arc(x, y, 16, 0, 2 * PI)
            ctx.save()
            ctx.set_source_rgba(0.06, 0.04, 0.16, alpha)
            ctx.fill_preserve()
            ctx.restore()
            ctx.stroke()
    elif kind == "highlight":
        for y, x1 in ((-36, 56), (-6, 56), (24, 20)):
            ctx.move_to(-60, y)
            ctx.line_to(x1, y)
        ctx.stroke()
        ctx.save()
        ctx.set_source_rgba(*color, alpha * 0.35)
        ctx.rectangle(-36, -18, 70, 24)
        ctx.fill()
        ctx.restore()
        ctx.move_to(34, -26)
        ctx.line_to(34, 14)
        ctx.stroke()
        ctx.move_to(-60, 50)
        ctx.line_to(-20, 50)
        ctx.stroke()
    elif kind == "gauge":
        ctx.arc(0, 18, 58, PI, 2 * PI)
        ctx.stroke()
        for k3 in range(5):
            a3 = PI + k3 * PI / 4
            ctx.move_to(46 * math.cos(a3), 18 + 46 * math.sin(a3))
            ctx.line_to(58 * math.cos(a3), 18 + 58 * math.sin(a3))
        ctx.stroke()
        ctx.move_to(0, 18)
        ctx.line_to(30, -18)
        ctx.stroke()
        ctx.arc(0, 18, 7, 0, 2 * PI)
        ctx.fill()
        ctx.move_to(-58, 44)
        ctx.line_to(58, 44)
        ctx.stroke()
    elif kind == "chip":
        ctx.rectangle(-36, -36, 72, 72)
        ctx.stroke()
        ctx.rectangle(-16, -16, 32, 32)
        ctx.fill()
        for t3 in (-20, 0, 20):
            for (ax, ay, bx, by) in ((t3, -36, t3, -56), (t3, 36, t3, 56), (-36, t3, -56, t3), (36, t3, 56, t3)):
                ctx.move_to(ax, ay)
                ctx.line_to(bx, by)
        ctx.stroke()
    elif kind == "hash":
        for x in (-16, 18):
            ctx.move_to(x + 8, -56)
            ctx.line_to(x - 8, 56)
        for y in (-18, 20):
            ctx.move_to(-54, y)
            ctx.line_to(54, y)
        ctx.stroke()
    elif kind == "laptop":
        ctx.rectangle(-50, -48, 100, 70)
        ctx.stroke()
        ctx.move_to(-66, 36)
        ctx.line_to(66, 36)
        ctx.line_to(58, 48)
        ctx.line_to(-58, 48)
        ctx.close_path()
        ctx.stroke()
    elif kind == "clock":
        ctx.arc(0, 4, 54, 0, 2 * PI)
        ctx.stroke()
        ctx.move_to(0, -24)
        ctx.line_to(0, 4)
        ctx.line_to(24, 18)
        ctx.stroke()
        for sx in (-1, 1):
            ctx.arc(sx * 40, -48, 14, math.radians(200 if sx < 0 else 270), math.radians(270 if sx < 0 else 340))
            ctx.stroke()
    elif kind == "mail":
        ctx.rectangle(-64, -44, 128, 88)
        ctx.stroke()
        ctx.move_to(-64, -44)
        ctx.line_to(0, 8)
        ctx.line_to(64, -44)
        ctx.stroke()
    elif kind == "mdfile":
        ctx.move_to(-46, -62)
        ctx.line_to(20, -62)
        ctx.line_to(46, -36)
        ctx.line_to(46, 62)
        ctx.line_to(-46, 62)
        ctx.close_path()
        ctx.stroke()
        font(ctx, F_ORB_BLACK, 34)
        w = tw(ctx, "MD")
        ctx.move_to(-w / 2, 22)
        ctx.show_text("MD")
        ctx.new_path()
    elif kind == "rewind":
        for x0 in (-6, 50):
            ctx.move_to(x0, -40)
            ctx.line_to(x0 - 56, 0)
            ctx.line_to(x0, 40)
            ctx.close_path()
        ctx.stroke()
    elif kind == "compress":
        ctx.rectangle(-26, -26, 52, 52)
        ctx.stroke()
        for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            ctx.move_to(sx * 62, sy * 62)
            ctx.line_to(sx * 36, sy * 36)
            ctx.move_to(sx * 36, sy * 54)
            ctx.line_to(sx * 36, sy * 36)
            ctx.line_to(sx * 54, sy * 36)
        ctx.stroke()
    elif kind == "bug":
        ctx.save()
        ctx.scale(0.8, 1)
        ctx.arc(0, 8, 46, 0, 2 * PI)
        ctx.restore()
        ctx.stroke()
        ctx.arc(0, -40, 16, PI, 2 * PI)
        ctx.stroke()
        ctx.move_to(0, -34)
        ctx.line_to(0, 54)
        ctx.stroke()
        for y in (-12, 12, 36):
            for sx in (-1, 1):
                ctx.move_to(sx * 36, y)
                ctx.line_to(sx * 60, y - 10)
        ctx.stroke()
    elif kind == "chat":
        ctx.move_to(-62, -48)
        ctx.line_to(62, -48)
        ctx.line_to(62, 28)
        ctx.line_to(-14, 28)
        ctx.line_to(-38, 54)
        ctx.line_to(-38, 28)
        ctx.line_to(-62, 28)
        ctx.close_path()
        ctx.stroke()
        font(ctx, F_ORB_BLACK, 62)
        w = tw(ctx, "?")
        ctx.move_to(-w / 2, 12)
        ctx.show_text("?")
        ctx.new_path()
    ctx.restore()


# ------------------------------------------------------------ static layers
rng = np.random.default_rng(5)
STARS = [(rng.uniform(0, W), rng.uniform(0, H * 0.8), rng.uniform(0.8, 2.4), rng.uniform(0, 2 * PI),
          rng.uniform(0.6, 2.2), rng.choice([0, 0, 0, 1, 2])) for _ in range(170)]


def make_binary_strip(width, seed):
    r = np.random.default_rng(seed)
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, H * 2)
    c = cairo.Context(surf)
    font(c, F_MONO, 19)
    for col in range(width // 20):
        x = 4 + col * 20
        y = r.uniform(0, 40)
        while y < H * 2:
            if r.random() < 0.8:
                a = r.uniform(0.1, 0.45)
                c.set_source_rgba(0.55, 0.8, 0.95, a)
                c.move_to(x, y)
                c.show_text(str(r.integers(0, 2)))
            y += 22
    return surf


BIN_L, BIN_R = make_binary_strip(66, 1), make_binary_strip(66, 2)


def make_bg():
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(surf)
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0.0, *hexc("#060518"))
    g.add_color_stop_rgb(0.35, *hexc("#120B33"))
    g.add_color_stop_rgb(0.62, *hexc("#2A1150"))
    g.add_color_stop_rgb(0.80, *hexc("#1E0C40"))
    g.add_color_stop_rgb(1.0, *hexc("#0D0722"))
    c.set_source(g)
    c.paint()
    for (x, y, r, col, a) in [(540, 1250, 900, "#7A22B8", 0.30), (200, 600, 700, "#1C3FA8", 0.18), (900, 1500, 700, "#B0249E", 0.16)]:
        rg = cairo.RadialGradient(x, y, 0, x, y, r)
        rg.add_color_stop_rgba(0, *hexc(col), a)
        rg.add_color_stop_rgba(1, *hexc(col), 0)
        c.set_source(rg)
        c.paint()
    return surf


BG = make_bg()
HORIZON = 1415


def grid(ctx, t):
    ctx.save()
    ctx.set_line_width(2)
    # verticals fanning from the vanishing point
    for k in range(-14, 15):
        xb = 540 + k * 150
        ctx.move_to(lerp(540, xb, 0.04), HORIZON + (H - HORIZON) * 0.04)
        ctx.line_to(xb, H)
    lg = cairo.LinearGradient(0, HORIZON, 0, H)
    lg.add_color_stop_rgba(0, *hexc("#B33BE6"), 0.0)
    lg.add_color_stop_rgba(0.3, *hexc("#B33BE6"), 0.22)
    lg.add_color_stop_rgba(1, *hexc("#B33BE6"), 0.42)
    ctx.set_source(lg)
    ctx.stroke()
    ph = (t * 0.55) % 1
    for n in range(1, 34):
        z = n - ph
        if z <= 0.2:
            continue
        y = HORIZON + 520 / z
        if y > H + 4:
            continue
        a = clamp((y - HORIZON) / 300) * 0.45
        ctx.move_to(0, y)
        ctx.line_to(W, y)
        ctx.set_source_rgba(*hexc("#B33BE6"), a)
        ctx.stroke()
    ctx.restore()


WAVES = [  # base, amps, ks, speeds, color, alpha
    (1490, (70, 30), (0.0062, 0.017), (0.9, -1.3), hexc("#3FCBFF"), 0.75),
    (1470, (60, 26), (0.0049, 0.013), (-0.7, 1.1), hexc("#9B6BFF"), 0.65),
    (1505, (45, 22), (0.0081, 0.021), (1.2, 0.6), hexc("#E04BD8"), 0.55),
]


def waves(ctx, t):
    ctx.save()
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    for base, (a1, a2), (k1, k2), (s1, s2), col, al in WAVES:
        ctx.new_path()
        for i, x in enumerate(range(-20, W + 21, 10)):
            env = 0.55 + 0.45 * math.sin(x * 0.0035 + t * 0.4)
            y = base + env * (a1 * math.sin(x * k1 + t * s1) + a2 * math.sin(x * k2 + t * s2 + 1.3))
            (ctx.move_to if i == 0 else ctx.line_to)(x, y)
        ctx.set_source_rgba(*col, al * 0.35)
        ctx.set_line_width(7)
        ctx.stroke_preserve()
        ctx.set_source_rgba(*col, al)
        ctx.set_line_width(2.4)
        ctx.stroke()
    ctx.restore()


def background(ctx, t):
    ctx.set_source_surface(BG, 0, 0)
    ctx.paint()
    for (x, y, r, ph, sp, kind) in STARS:
        a = 0.25 + 0.6 * abs(math.sin(t * sp + ph))
        col = [(0.85, 0.85, 1.0), (1.0, 0.45, 0.9), (0.4, 0.9, 1.0)][kind]
        ctx.arc(x, y, r, 0, 2 * PI)
        ctx.set_source_rgba(*col, a)
        ctx.fill()
    off = (t * 34) % H
    for surf, x in ((BIN_L, 0), (BIN_R, W - 66)):
        ctx.save()
        ctx.rectangle(x, 0, 66, H)
        ctx.clip()
        ctx.set_source_surface(surf, x, off - H)
        ctx.paint_with_alpha(0.55)
        ctx.restore()
    grid(ctx, t)
    waves(ctx, t)


# ------------------------------------------------------------ sphere
RINGS = []
for k in range(7):
    th = k * PI / 7
    tilt = [0.35, 1.1, -0.6, 0.85, -1.2, 0.2, 1.4][k]
    u = np.array([math.cos(th), 0, math.sin(th)])
    v = np.array([-math.sin(th) * math.sin(tilt), math.cos(tilt), math.cos(th) * math.sin(tilt)])
    v -= u * (u @ v)
    v /= np.linalg.norm(v)
    RINGS.append((u, v, k % 2))
ANG = np.linspace(0, 2 * PI, 73)


def sphere(ctx, t, cx, cy, r, col, alpha):
    if alpha <= 0:
        return
    ry, rx = t * 0.45, 0.35 + 0.1 * math.sin(t * 0.3)
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    M = Rx @ Ry
    ctx.save()
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for u, v, which in RINGS:
        pts = (np.outer(np.cos(ANG), u) + np.outer(np.sin(ANG), v)) @ M.T
        c = col if which == 0 else ORANGE
        for i in range(len(ANG) - 1):
            z = (pts[i, 2] + pts[i + 1, 2]) / 2
            a = alpha * (0.35 + 0.65 * (z + 1) / 2)
            ctx.move_to(cx + r * pts[i, 0], cy + r * pts[i, 1])
            ctx.line_to(cx + r * pts[i + 1, 0], cy + r * pts[i + 1, 1])
            ctx.set_source_rgba(*c, a)
            ctx.set_line_width(2.6)
            ctx.stroke()
    ctx.restore()


# ------------------------------------------------------------ header
def atom(ctx, cx, cy, t):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(t * 0.15)
    for k in range(3):
        ctx.save()
        ctx.rotate(k * PI / 3)
        ctx.scale(1, 0.38)
        ctx.new_path()
        ctx.arc(0, 0, 43, 0, 2 * PI)
        ctx.restore()
        g = cairo.LinearGradient(-40, -40, 40, 40)
        g.add_color_stop_rgb(0, *hexc("#FF4FD8"))
        g.add_color_stop_rgb(0.6, *hexc("#C25BFF"))
        g.add_color_stop_rgb(1, *hexc("#FF9A4A"))
        ctx.set_source(g)
        ctx.set_line_width(4.5)
        ctx.stroke()
    ctx.arc(0, 0, 6, 0, 2 * PI)
    ctx.set_source_rgb(*hexc("#FF7AE0"))
    ctx.fill()
    ctx.restore()


def header(ctx, t, prog_state):
    atom(ctx, 148, 150, t)
    text(ctx, "CLAUDE AI", 230, 128, F_ORB_BOLD, 31, hexc("#8FE6F2"), 0.95, spacing=1.5)
    font(ctx, F_ORB_BLACK, 74)
    w = tw(ctx, "TIPS & TRICKS")
    g = cairo.LinearGradient(228, 0, 228 + w, 0)
    g.add_color_stop_rgb(0, *G_CYAN)
    g.add_color_stop_rgb(0.5, *G_MID)
    g.add_color_stop_rgb(1, *G_PINK)
    ctx.set_source(g)
    ctx.move_to(228, 205)
    ctx.show_text("TIPS & TRICKS")
    ctx.new_path()
    # progress
    gap, x0, y0 = 18, 90, 290
    segw = (900 - gap * 4) / 5
    for k in range(5):
        x = x0 + k * (segw + gap)
        ctx.rectangle(x, y0, segw, 6)
        ctx.set_source_rgba(1, 1, 1, 0.08)
        ctx.fill()
        f = prog_state[k]
        if f > 0:
            ctx.rectangle(x, y0, segw * f, 6)
            ctx.set_source_rgba(*COLS[k], 1)
            ctx.fill()


# ------------------------------------------------------------ card + chips
CARD = (70, 400, 1010, 1080)
CHIP_Y0, CHIP_PITCH, CHIP_H = 1120, 128, 108
LIFT = 260  # recap rows rise this far as the last card files into the list


def chip_rect(k, lift=0.0):
    y = CHIP_Y0 + k * CHIP_PITCH - lift
    return (90, y, 990, y + CHIP_H)


def panel(ctx, rect, col, alpha, fill_a=0.78, kind="card"):
    x0, y0, x1, y1 = rect
    (hud_path if kind == "card" else chip_path)(ctx, x0, y0, x1, y1)
    g = cairo.LinearGradient(0, y0, 0, y1)
    g.add_color_stop_rgba(0, *hexc("#0E0B2C"), fill_a * alpha)
    g.add_color_stop_rgba(1, *hexc("#1C0D3E"), fill_a * alpha)
    ctx.set_source(g)
    ctx.fill_preserve()
    ctx.set_source_rgba(*col, 0.35 * alpha)
    ctx.set_line_width(9)
    ctx.stroke_preserve()
    ctx.set_source_rgba(*col, alpha)
    ctx.set_line_width(3)
    ctx.stroke()


def chip_content(ctx, k, rect, alpha):
    if alpha <= 0:
        return
    tip, col = TIPS[k], COLS[k]
    x0, y0, x1, y1 = rect
    ctx.save()
    ctx.translate(0, y0 + (y1 - y0 - CHIP_H) / 2)
    text(ctx, f"{k + 1:02d}", x0 + 36, 72, F_ORB_BLACK, 46, col, alpha)
    text(ctx, tip["cat"], x0 + 156, 42, F_ORB_BOLD, 21, col, alpha, spacing=1)
    text(ctx, tip["head"], x0 + 156, 84, F_HEAD_B, 34, WHITE, alpha)
    icon(ctx, tip["icon"], x1 - 100, 54, 0.32, col, alpha, lw=7)
    ctx.restore()


def lift_at(t):
    return LIFT * eio(prog(t, EV[-1]["card_out"], EV[-1]["card_out"] + 0.6))


def typed(s, p):
    return s[: int(round(len(s) * clamp(p)))]


def card(ctx, k, t, ev):
    tip, col = TIPS[k], COLS[k]
    ci, co = ev["card_in"], ev["card_out"]
    a_in = eo3(prog(t, ci, ci + 0.35))
    flick = 1.0 if t > ci + 0.25 else (0.55 + 0.45 * (math.sin((t - ci) * 90) > -0.2))
    morph = eio(prog(t, co, co + 0.6))
    content_a = a_in * (1 - prog(t, co, co + 0.18))
    if a_in <= 0:
        return
    # frame: card -> chip morph
    cr, chr_ = CARD, chip_rect(k, lift_at(t))
    rect = tuple(lerp(a, b, morph) for a, b in zip(cr, chr_))
    sy = lerp(0.92, 1.0, a_in)
    cy = (rect[1] + rect[3]) / 2
    rect = (rect[0], cy + (rect[1] - cy) * sy, rect[2], cy + (rect[3] - cy) * sy)
    if morph < 1:
        panel(ctx, rect, col, a_in * flick, kind="card" if morph < 0.5 else "chip")
        chip_content(ctx, k, rect, prog(morph, 0.95, 1.0))
    if content_a <= 0:
        return
    a = content_a * flick
    # number + icon
    text(ctx, f"{k + 1:02d}", 135, 590, F_ORB_BLACK, 150, col, a * prog(t, ci + 0.05, ci + 0.3))
    icon(ctx, tip["icon"], 845, 535, 1.0, col, a * prog(t, ci + 0.12, ci + 0.45))
    # category + underline
    p = eo3(prog(t, ci + 0.18, ci + 0.5))
    text(ctx, tip["cat"], 132 - 30 * (1 - p), 680, F_ORB_BOLD, 44, WHITE, a * p, spacing=2)
    tg = eo3(prog(t, ci + 0.35, ci + 0.7))
    if tg > 0 and tip.get("tag"):
        font(ctx, F_ORB_BOLD, 26)
        tgw = tw(ctx, tip["tag"], 1)
        px1 = 984
        px0 = px1 - tgw - 36
        ctx.new_path()
        ctx.move_to(px0 + 12, 636)
        ctx.line_to(px1, 636)
        ctx.line_to(px1, 678)
        ctx.line_to(px1 - 12, 690)
        ctx.line_to(px0, 690)
        ctx.line_to(px0, 648)
        ctx.close_path()
        ctx.set_source_rgba(*col, 0.14 * a * tg)
        ctx.fill_preserve()
        ctx.set_source_rgba(*col, a * tg)
        ctx.set_line_width(2)
        ctx.stroke()
        text(ctx, tip["tag"], px0 + 18, 673, F_ORB_BOLD, 26, col, a * tg, spacing=1)
    u = eo3(prog(t, ci + 0.25, ci + 0.95))
    if u > 0:
        g = cairo.LinearGradient(132, 0, 980, 0)
        g.add_color_stop_rgba(0, *col, a)
        g.add_color_stop_rgba(0.55, *col, a * 0.6)
        g.add_color_stop_rgba(1, *col, 0)
        ctx.rectangle(132, 714, (980 - 132) * u, 3)
        ctx.set_source(g)
        ctx.fill()
    # headline typing
    lines = wrap(ctx, tip["head"], F_HEAD, 68, 790)
    full = " ".join(lines)
    hp = prog(t, ev["head_type"][0], ev["head_type"][1])
    shown = typed(full, hp)
    pos = 0
    for i, line in enumerate(lines):
        seg = shown[pos:pos + len(line)]
        pos += len(line) + 1
        if seg:
            text(ctx, seg, 132, 810 + i * 84, F_HEAD, 68, WHITE, a)
    # separator
    ctx.rectangle(92, 918, 898 * u, 2)
    ctx.set_source_rgba(*col, 0.3 * a)
    ctx.fill()
    # terminal line
    term = tip["term"]
    fs, sp = 40, 3.0
    font(ctx, F_MONO, fs)
    while tw(ctx, term, sp) > 790 and fs > 28:  # keep the line (plus cursor) inside the card
        if sp > 1:
            sp -= 0.5
        else:
            fs -= 1
        font(ctx, F_MONO, fs)
    tp = prog(t, ev["term_type"][0], ev["term_type"][1])
    s = "> " + typed(term[2:], tp) if tp > 0 else ">"
    if t >= ci + 0.35:
        wdt = text(ctx, s, 132, 1012, F_MONO, fs, col, a, spacing=sp)
        typing = 0 < tp < 1 or 0 < hp < 1
        if typing or math.sin(t * 2 * PI * 1.6) > 0:
            ctx.rectangle(132 + wdt + 8, 1012 - fs * 0.75, fs * 0.35, fs * 0.95)
            ctx.set_source_rgba(*col, a)
            ctx.fill()


# ------------------------------------------------------------ timeline events
EV = []
for k, tp in enumerate(TL["tips"]):
    i0, i1 = tp["intro"]
    h0, h1 = tp["head"]
    d0, d1 = tp["detail"]
    EV.append(dict(
        card_in=i0 - 0.32,
        head_type=(i1 - 0.15, i1 - 0.15 + max(0.6, (h1 - h0) * TIPS[k].get("type_frac", 0.9))),
        # per-tip: delay typing until the matching words are spoken, and/or type faster
        term_type=(h1 + 0.05 + TIPS[k].get("term_delay", 0.0),
                   h1 + 0.05 + TIPS[k].get("term_delay", 0.0)
                   + max(0.9, (d1 - d0 - TIPS[k].get("term_delay", 0.0)) * TIPS[k].get("term_frac", 0.75))),
        card_out=d1 + 0.18,
        seg=(i0 - 0.32, (TL["tips"][k + 1]["intro"][0] - 0.32) if k < 4 else d1 + 0.4),
    ))
OUT0 = TL["outro_vo"][0]


def frame(ctx, t):
    background(ctx, t)
    # sphere: "focus" pose between cards, tucked behind the card while one is up
    focus = 1.0
    col = COLS[0]
    for k, ev in enumerate(EV):
        a_in = eio(prog(t, ev["card_in"] - 0.1, ev["card_in"] + 0.35))
        a_out = eio(prog(t, ev["card_out"], ev["card_out"] + 0.5))
        focus = min(focus, 1 - a_in + a_out)
        if t >= ev["card_in"] - 0.3:
            col = COLS[k]
    if t >= EV[-1]["card_out"]:
        col = COLS[4]
    cx, cy, r = lerp(880, 820, focus), lerp(470, 560, focus), lerp(178, 215, focus)
    sphere(ctx, t, cx, cy, r, col, lerp(0.55, 1.0, focus))
    # active cards (current one, and the previous one while it files away) slide BEHIND the filed list
    for k, ev in enumerate(EV):
        if ev["card_in"] - 0.05 <= t < ev["card_out"] + 0.6:
            card(ctx, k, t, ev)
    # chips already filed; for the recap they rise clear of the platform caption area
    lift = lift_at(t)
    for k, ev in enumerate(EV):
        if t >= ev["card_out"] + 0.6:
            rect = chip_rect(k, lift)
            panel(ctx, rect, COLS[k], 1, kind="chip")
            chip_content(ctx, k, rect, 1)
    # hook title (on screen from frame 0 = the default cover) and outro title
    ha = 1 - prog(t, EV[0]["card_in"] - 0.35, EV[0]["card_in"] + 0.05)
    oa_out = eo3(prog(t, OUT0 - 0.35, OUT0 + 0.25))
    for lines, oa, y0 in ((HOOK_TITLE, ha, 690), (("MASTER", "CLAUDE AI"), oa_out, 600)):
        if oa <= 0:
            continue
        for i, line in enumerate(lines):
            font(ctx, F_ORB_BLACK, 100)
            w = tw(ctx, line, 4)
            x = 540 - w / 2
            y = y0 + i * 118 + 30 * (1 - oa)
            g = cairo.LinearGradient(x, 0, x + w, 0)
            g.add_color_stop_rgba(0, *G_CYAN, oa)
            g.add_color_stop_rgba(0.5, *G_MID, oa)
            g.add_color_stop_rgba(1, *G_PINK, oa)
            ctx.set_source(g)
            for ch in line:
                ctx.move_to(x, y)
                ctx.show_text(ch)
                x += ctx.text_extents(ch).x_advance + 4
            ctx.new_path()
    ca = eo3(prog(t, OUT0 + 0.1, OUT0 + 0.55))
    if ca > 0:
        text(ctx, "SAVE + FOLLOW FOR DAILY AI FINDS", 540, 822 + 16 * (1 - ca), F_ORB_BOLD, 34, WHITE, 0.92 * ca,
             spacing=2, align="center")
    ps = [prog(t, ev["seg"][0], ev["seg"][1]) for ev in EV]
    header(ctx, t, ps)


def bloom(surf, ctx):
    surf.flush()
    buf = np.ndarray((H, W, 4), np.uint8, surf.get_data())
    small = buf.reshape(H // 4, 4, W // 4, 4, 4).mean((1, 3)) / 255.0
    small = small ** 2.2
    b = gaussian_filter(small, (2.5, 2.5, 0)) * 0.9 + gaussian_filter(small, (9, 9, 0)) * 1.4
    out = np.clip(b * 255, 0, 255).astype(np.uint8)
    out[..., 3] = out[..., :3].max(-1)
    out = np.ascontiguousarray(out)
    bs = cairo.ImageSurface.create_for_data(out, cairo.FORMAT_ARGB32, W // 4, H // 4)
    ctx.save()
    ctx.scale(4, 4)
    ctx.set_source_surface(bs, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_BILINEAR)
    ctx.set_operator(cairo.OPERATOR_ADD)
    ctx.paint_with_alpha(0.75)
    ctx.restore()


def render(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    frame(ctx, t)
    bloom(surf, ctx)
    fa = prog(t, TOTAL - 1.0, TOTAL)
    if fa > 0:
        ctx.set_source_rgba(0, 0, 0, fa)
        ctx.paint()
    surf.flush()
    return surf


def main():
    if sys.argv[1] == "stills":
        os.makedirs(sys.argv[2], exist_ok=True)
        for ts in sys.argv[3:]:
            render(float(ts)).write_to_png(os.path.join(sys.argv[2], f"s_{float(ts):06.2f}.png"))
        return
    out, audio = sys.argv[2], sys.argv[3]
    n = int(round(TOTAL * FPS))
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", audio,
                           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out],
                          stdin=subprocess.PIPE)
    for i in range(n):
        ff.stdin.write(render(i / FPS).get_data())
        if i % 150 == 0:
            print(f"frame {i}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("done", out)


if __name__ == "__main__":
    main()
