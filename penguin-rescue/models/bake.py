# Bake the cast into game-ready models: the paper look (watercolour wash, every pen line and
# hatch stroke) is rendered straight-on into one texture per character, then the cut cards are
# joined into a single mesh whose fronts are projected onto that texture. The pen geometry
# itself is left out; it lives in the texture. Edges show the paper core, backs plain card.
# Run: blender -b -P models/bake.py [-- name ...]  ->  models/baked/<name>.glb (+ <name>.png texture)
import bpy, bmesh, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cast                    # defines the cast (and resets the scene); builds nothing yet
import popup as P

OUT = os.path.join(HERE, "baked")
os.makedirs(OUT, exist_ok=True)
PX_PER_UNIT = 900              # texture density in the world; ~1000 px for Tuck
MAX_PX = 2048                  # cap for the long figures (Grimfin, Bobble)
PAD = 0.02                     # world units of margin round the silhouette
SAT, CONTRAST = 1.12, 1.06       # colour lift applied to the baked art
TOL = 0.0012                   # world units an outline may move when simplified (under a pixel in game)

def simplify(o, tol):
    """Drop outline points that sit within tol of the line between their neighbours."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    while len(bm.verts) > 8:
        bm.faces.ensure_lookup_table()
        kill, last = [], None
        for l in bm.faces[0].loops:
            a, b, c = l.link_loop_prev.vert.co, l.vert.co, l.link_loop_next.vert.co
            chord = c - a
            if l.link_loop_prev.vert is not last and chord.length > 1e-9 and (b - a).cross(chord).length / chord.length < tol:
                kill.append(l.vert); last = l.vert
        if not kill:
            break
        bmesh.ops.dissolve_verts(bm, verts=kill)
    bm.to_mesh(o.data)
    bm.free()

def flat_paint():
    """Swap every paper shader for pure emission of its watercolour colour, so a render is the albedo."""
    for m in bpy.data.materials:
        nt = m.node_tree
        ramp = next(n for n in nt.nodes if n.type == 'VALTORGB')
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        em = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
        nt.links.new(em.outputs["Emission"], out.inputs["Surface"])

def dilate(img, steps=8):
    """Grow colour outward into the empty pixels so texture filtering never pulls in a dark fringe."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    rgb, known = px[..., :3].copy(), px[..., 3] > 0.01
    for _ in range(steps):
        acc, cnt = np.zeros_like(rgb), np.zeros(known.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            cnt += k
        grow = ~known & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow, None]
        known |= grow
    # a small lift so the soft watercolour holds its own under the game's warm light and tone mapping
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(0.5 + ((grey + (rgb - grey) * SAT) - 0.5) * CONTRAST, 0, 1)
    img.pixels.foreach_set(np.concatenate([rgb, np.ones((h, w, 1), np.float32)], axis=2).ravel())

def bake(name, root, parts):
    sc = bpy.context.scene
    # the easel tab only props the figure up in Blender previews; the game stands figures itself
    cards = [o for o in parts if any(m.type == 'SOLIDIFY' for m in o.modifiers) and not o.name.endswith(".tab")]
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in cards for v in o.data.vertices]
    x0, x1 = min(p.x for p in pts) - PAD, max(p.x for p in pts) + PAD
    z0, z1 = min(p.z for p in pts) - PAD, max(p.z for p in pts) + PAD
    W, H = x1 - x0, z1 - z0
    scale = min(PX_PER_UNIT, MAX_PX / max(W, H))
    rx, rz = round(W * scale), round(H * scale)

    # 1. the art, rendered flat and straight-on with an orthographic camera
    for n, (r, objs) in groups.items():
        for o in [r] + objs:
            o.hide_render = n != name or o.name.endswith(".tab")
    cam = bpy.data.objects.new("bakecam", bpy.data.cameras.new("bakecam"))
    sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(W, H)
    cam.location = ((x0 + x1) / 2, -20, (z0 + z1) / 2)
    cam.rotation_euler = (1.5707963, 0, 0)          # look along +Y, z up
    cam.data.clip_end = 100
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = rx, rz
    sc.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(sc.render.filepath)
    dilate(img)
    img.save()
    bpy.data.objects.remove(cam)

    # 2. one mesh of the cut cards (modifiers applied), fronts mapped onto the art
    for o in cards:
        simplify(o, TOL / o.matrix_world.to_scale().x)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for o in cards:
        m = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
        m.transform(o.matrix_world)
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        f.normal_update()
        ny = f.normal.y
        f.material_index = 0 if ny < -0.5 else (1 if ny > 0.5 else 2)   # front art / plain back / paper core
        for l in f.loops:
            l[uv].uv = ((l.vert.co.x - x0) / W, (l.vert.co.z - z0) / H)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:   # flat card faces; the thin cut edges shade smoothly so they can share vertices
        p.use_smooth = p.material_index == 2

    art = bpy.data.materials.new(f"{name}_paper")
    art.use_nodes = True
    bsdf = art.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.92
    tex = art.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = 'Linear'
    art.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    for m in (art, plain("card_back", P.BACK), plain("card_core", P.CORE)):
        me.materials.append(m)

    obj = bpy.data.objects.new(name, me)
    sc.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{name}.glb"), export_format='GLB',
                              use_selection=True, export_image_format='JPEG', export_image_quality=92)
    bpy.data.objects.remove(obj)
    return rx, rz, len(me.polygons)

def plain(name, color):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*P.lin(color), 1)
    b.inputs["Roughness"].default_value = 0.95
    return m

want = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(cast.CAST)
groups = {}
for name in want:
    cast.CAST[name]()
    groups[name] = (P.root, list(P.parts))
flat_paint()
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'
sc.render.film_transparent = True
sc.render.filter_size = 1.0
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
for name, (root, parts) in groups.items():
    rx, rz, faces = bake(name, root, parts)
    print(f"BAKED {name}: texture {rx}x{rz}, {faces} faces")
