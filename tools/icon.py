"""Generate Virtuve app icon/splash/favicon: a cooking pot on warm amber."""
from PIL import Image, ImageDraw
import os

AMBER = (242, 163, 60)
AMBER_DEEP = (217, 133, 33)
DARK = (42, 26, 0)
CREAM = (245, 243, 236)

S = 1024
OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def base():
    img = Image.new("RGB", (S, S), AMBER)
    d = ImageDraw.Draw(img)
    # subtle vertical gradient
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(AMBER, AMBER_DEEP, y / S))
    return img, d


def draw_pot(d, cx, cy, scale=1.0, color=DARK):
    w = int(360 * scale)
    h = int(250 * scale)
    left, right = cx - w // 2, cx + w // 2
    top = cy - h // 2
    bottom = cy + h // 2
    # handles
    hr = int(55 * scale)
    d.ellipse([left - hr, cy - hr // 2, left + hr // 3, cy + hr // 2], fill=color)
    d.ellipse([right - hr // 3, cy - hr // 2, right + hr, cy + hr // 2], fill=color)
    # body (rounded)
    d.rounded_rectangle([left, top, right, bottom], radius=int(46 * scale), fill=color)
    # lid
    lid_h = int(60 * scale)
    d.rounded_rectangle([left - int(18 * scale), top - lid_h, right + int(18 * scale), top + int(14 * scale)],
                        radius=int(26 * scale), fill=color)
    # knob
    kr = int(34 * scale)
    d.ellipse([cx - kr, top - lid_h - kr, cx + kr, top - lid_h + kr], fill=color)


def draw_steam(d, cx, top_y, scale=1.0, color=DARK):
    import math
    for dx in (-110, 0, 110):
        pts = []
        x0 = cx + int(dx * scale)
        for t in range(0, 101, 4):
            yy = top_y - int(t * 1.9 * scale)
            xx = x0 + int(math.sin(t / 12.0) * 26 * scale)
            pts.append((xx, yy))
        d.line(pts, fill=color, width=int(20 * scale), joint="curve")


def make_icon():
    img, d = base()
    draw_steam(d, S // 2, int(S * 0.40), 1.0, DARK)
    draw_pot(d, S // 2, int(S * 0.60), 1.0, DARK)
    return img


icon = make_icon()
icon.save(os.path.join(OUT, "icon.png"))
icon.save(os.path.join(OUT, "adaptive-icon.png"))
# splash: pot a bit smaller on amber, transparent-ish not needed (config sets bg)
splash = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(splash)
draw_steam(sd, S // 2, int(S * 0.42), 0.9, DARK)
draw_pot(sd, S // 2, int(S * 0.60), 0.9, DARK)
splash.save(os.path.join(OUT, "splash-icon.png"))
icon.resize((96, 96)).save(os.path.join(OUT, "favicon.png"))
print("wrote icon.png, adaptive-icon.png, splash-icon.png, favicon.png to assets/")
