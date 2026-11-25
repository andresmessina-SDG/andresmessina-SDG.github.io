# Shared drawing kit for the pop-up cast: cut card with a paper core, watercolour wash,
# nib-weight pen lines and parallel hatching. Each character is built in its own unit
# coordinates (x right, z up, feet at z=0) under an Empty scaled to its size in the world,
# so line weights and card relief are divided by that size and read the same on everyone.
import bpy, bmesh, math, random
from mathutils import Vector

TAU = math.tau
rng = random.Random(7)

INK = '#352d2a'        # warm sepia pen
CORE = '#f3ecdc'       # the pale core of a cut paper edge
BACK = '#fdfaf2'       # die-cut margin
CARD = 0.0035          # card thickness
GAP = 0.0045           # air between pop-up layers

def lin(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i+2], 16) / 255) ** 2.2 for i in (0, 2, 4))

_mats = {}
def paper(color, wash=0.10):
    """Watercolour on card: the colour pools a little darker in soft blotches, over a fibre bump."""
    key = (color, wash)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(color)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    blot = nt.nodes.new("ShaderNodeTexNoise"); blot.inputs["Scale"].default_value = 9; blot.inputs["Detail"].default_value = 3
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    c = lin(color)
    ramp.color_ramp.elements[0].color = (*[v * (1 - wash) for v in c], 1)
    ramp.color_ramp.elements[1].color = (*c, 1)
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.35, 0.65
    nt.links.new(blot.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    fibre = nt.nodes.new("ShaderNodeTexNoise"); fibre.inputs["Scale"].default_value = 260
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.06
    nt.links.new(fibre.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    _mats[key] = m
    return m

# ---------- 2D shape helpers ----------
def ccw(pts):
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if area > 0 else pts[::-1]

def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)

def smooth(points, n=10):
    """Closed Catmull-Rom curve through control points."""
    out, m = [], len(points)
    for i in range(m):
        p0, p1, p2, p3 = (Vector(points[(i + j) % m]) for j in (-1, 0, 1, 2))
        out += [tuple(_cr(p0, p1, p2, p3, k / n)) for k in range(n)]
    return ccw(out)

def open_curve(points, n=8):
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = (Vector(pts[i + j]) for j in (-1, 0, 1, 2))
        out += [tuple(_cr(p0, p1, p2, p3, k / n)) for k in range(n)]
    return out + [tuple(points[-1])]

def mirror(half):
    """Right half from top (x=0) to bottom (x=0) -> full closed outline."""
    return half + [(-x, z) for x, z in reversed(half[1:-1])]

def ellipse(cx, cz, rx, rz, n=40, rot=0):
    pts = [(cx + rx * math.cos(i / n * TAU), cz + rz * math.sin(i / n * TAU)) for i in range(n)]
    return ccw(rotate(pts, rot, (cx, cz)) if rot else pts)

def fluffy(cx, cz, r, tufts=14, depth=0.07, n=96):
    """A fur ruff or pompom: a circle whose edge bumps out in soft tufts."""
    return ccw([(cx + r * (1 + depth * abs(math.sin(tufts / 2 * a))) * math.cos(a),
                 cz + r * (1 + depth * abs(math.sin(tufts / 2 * a))) * math.sin(a)) for a in (i / n * TAU for i in range(n))])

def offset(pts, d):
    """Push a counter-clockwise outline outward by d."""
    out, n = [], len(pts)
    for i in range(n):
        t = (Vector(pts[(i + 1) % n]) - Vector(pts[i - 1])).normalized()
        out.append(tuple(Vector(pts[i]) + Vector((t.y, -t.x)) * d))
    return out

def rotate(pts, deg, c):
    cr, sr, c = math.cos(math.radians(deg)), math.sin(math.radians(deg)), Vector(c)
    return [tuple(c + Vector(((x - c.x) * cr - (z - c.y) * sr, (x - c.x) * sr + (z - c.y) * cr))) for x, z in pts]

def move(pts, dx=0, dz=0, sx=1, sz=1, c=(0, 0)):
    """Scale about c, then shift."""
    return [(c[0] + (x - c[0]) * sx + dx, c[1] + (z - c[1]) * sz + dz) for x, z in pts]

def flipx(pts):
    return ccw([(-x, z) for x, z in pts])

def inside(p, poly):
    x, z, hit = p[0], p[1], False
    for i in range(len(poly)):
        (x1, z1), (x2, z2) = poly[i], poly[i - 1]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            hit = not hit
    return hit

def crescent(shape, dx=-0.06, dz=0.035):
    """Shadow side: inside the shape but outside a copy of it nudged toward the light (upper left)."""
    moved = [(x + dx, z + dz) for x, z in shape]
    return lambda p: not inside(p, moved)

# ---------- one character at a time ----------
K = 1.0          # 1 / the character's size: keeps pen and card the same weight on everyone
root = None      # the character's Empty
parts = []

def begin(name, size):
    global K, root, parts
    K = 1 / size
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.scale = (size, size, size)
    parts = []
    return root

def _obj(name, me, y, mats):
    o = bpy.data.objects.new(f"{root.name}.{name}", me)
    bpy.context.collection.objects.link(o)
    o.parent = root
    o.location.y = y
    for m in mats:
        me.materials.append(m)
    parts.append(o)
    return o

def card(name, pts, layer, color, wash=0.10):
    """One piece of cut card; its printed face is toward the reader (-Y), the paper core shows on the edge."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in pts])
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    bm.to_mesh(me); bm.free()
    o = _obj(name, me, -layer * GAP * K, [paper(color, wash), paper(CORE, 0)])
    sol = o.modifiers.new("card", 'SOLIDIFY')
    sol.thickness, sol.offset, sol.material_offset_rim = CARD * K, -1, 1
    return o

def ribbon(name, pts, widths, layer, color, closed):
    """Printed pen line: a strip of quads lying on the face of the card at `layer`."""
    n = len(pts)
    L, R = [], []
    for i in range(n):
        a = Vector(pts[i - 1] if (closed or i) else pts[0])
        b = Vector(pts[(i + 1) % n] if (closed or i < n - 1) else pts[-1])
        t = (b - a).normalized(); nrm = Vector((-t.y, t.x)) * widths[i] * 0.5
        L.append(Vector(pts[i]) + nrm); R.append(Vector(pts[i]) - nrm)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    lv = [bm.verts.new((p.x, 0, p.y)) for p in L]
    rv = [bm.verts.new((p.x, 0, p.y)) for p in R]
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        f = bm.faces.new((lv[i], lv[j], rv[j], rv[i]))
        f.normal_update()
        if f.normal.y > 0:
            f.normal_flip()
    bm.to_mesh(me); bm.free()
    _obj(name, me, -layer * GAP * K - 0.0007 * K, [paper(color, 0)])

def ink(name, pts, layer, w=0.0055, closed=True, color=INK):
    """A nib line: the weight swells and thins as a hand presses; open strokes taper at both ends."""
    s = rng.random() * 10
    n = len(pts)
    ws = []
    for i in range(n):
        u = i / n
        k = 0.62 + 0.30 * math.sin(u * TAU * 2 + s) + 0.18 * math.sin(u * TAU * 5 + 2 * s)
        if not closed:
            k = (0.8 + 0.2 * math.sin(u * 7 + s)) * max(0.0, math.sin(math.pi * i / (n - 1))) ** 0.5
        ws.append(max(0.0004, w * K * k))
    ribbon(name, pts, ws, layer, color, closed)

def line(name, points, layer, w=0.003, color=INK):
    """A short open pen stroke through a few control points."""
    ink(name, open_curve(points), layer, w, closed=False, color=color)

def hatch(name, shade, clip, layer, angle=62, spacing=0.0105, w=0.0024, color=INK):
    """Parallel pen hatching inside the outline `clip`, wherever `shade(point)` holds."""
    xs, zs = [p[0] for p in clip], [p[1] for p in clip]
    c = Vector(((min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2))
    R = max(max(xs) - min(xs), max(zs) - min(zs))
    d = Vector((math.cos(math.radians(angle)), math.sin(math.radians(angle))))
    nrm = Vector((-d.y, d.x))
    sp, step = spacing * K, 0.004 * K
    k = 0
    for i in range(int(-R / sp), int(R / sp)):
        base = c + nrm * (i * sp + rng.uniform(-0.0015, 0.0015) * K)
        run = []
        for j in range(int(-R / step), int(R / step) + 1):
            p = base + d * (j * step)
            if inside(p, clip) and shade(p):
                run.append(tuple(p))
                continue
            if len(run) >= 3:
                ink(f"{name}{k}", run, layer, w, closed=False, color=color); k += 1
            run = []

def inked(name, pts, layer, color, w=0.005, wash=0.10):
    """A coloured piece of card with its pen outline."""
    card(name, pts, layer, color, wash)
    ink(name + "_ink", pts, layer, w)

def backing(shapes, margin=0.034):
    """The white die-cut margin round the whole silhouette, like the game's cut-outs."""
    for i, sh in enumerate(shapes):
        card(f"backing{i}", offset(sh, margin * K), -i * 0.08, BACK, wash=0)

def easel(x0, x1, z0, h):
    """A hinged stand folded back behind the figure, like a pop-up's tab."""
    tab = card("tab", [(x0, z0), (x1, z0), (x1 - 0.02, z0 + h), (x0 + 0.02, z0 + h)], -1, BACK, wash=0)
    tab.location.y = 0.012 * K
    tab.rotation_euler.x = math.radians(-35)
