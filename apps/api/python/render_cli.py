#!/usr/bin/env python3
"""Headless Blender render of a node-tree on a sphere.

Run via:
    blender --background --factory-startup --python render_cli.py -- <input.json> <output.png>

Where <input.json> contains the node-runner tree JSON ({nodes, links}).
The script is intentionally defensive: any unknown node type, missing socket,
or property that can't be assigned is silently skipped so a partial preview
still renders instead of crashing.

Inside Blender we have full bpy access. Outside (i.e. running with system
python for syntax checks) this would fail at import; that's expected.
"""
from __future__ import annotations

import json
import sys
import traceback

try:
    import bpy  # type: ignore[import-not-found]
except ImportError:
    sys.stderr.write("render_cli must be run by Blender, not system python\n")
    sys.exit(2)


def parse_argv() -> tuple[str, str]:
    # Blender forwards arguments after `--` to the script via sys.argv.
    if "--" in sys.argv:
        idx = sys.argv.index("--")
        args = sys.argv[idx + 1:]
    else:
        args = []
    if len(args) < 2:
        sys.stderr.write("usage: render_cli.py -- <input.json> <output.png>\n")
        sys.exit(2)
    return args[0], args[1]


def setup_scene() -> None:
    """Clear the default cube, drop in a smooth UV sphere, sane camera + lights."""
    scene = bpy.context.scene

    # Wipe default objects so we start clean.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    # Sphere
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=64, ring_count=32)
    sphere = bpy.context.active_object
    sphere.name = "PreviewSphere"
    bpy.ops.object.shade_smooth()

    # Camera
    cam_data = bpy.data.cameras.new("Camera")
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0, -3.2, 1.6)
    cam_obj.rotation_euler = (1.1, 0, 0)
    scene.camera = cam_obj

    # Key/fill/rim lights so PBR materials read cleanly at any roughness.
    for name, loc, energy, color in [
        ("Key",  (2.5, -1.5,  3.0), 800, (1.0, 0.97, 0.92)),
        ("Fill", (-3.0, 1.5, 2.0),  400, (0.75, 0.85, 1.0)),
        ("Rim",  (-1.0, 2.5, -2.0), 500, (1.0, 0.85, 0.70)),
    ]:
        ld = bpy.data.lights.new(name, type="POINT")
        ld.energy = energy
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        scene.collection.objects.link(lo)

    # Render settings: Eevee for speed, transparent background, modest samples.
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"  # Blender 4.x
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"       # Blender 3.x
    try:
        scene.eevee.taa_render_samples = 16
    except Exception:
        pass


def has_shader_nodes(tree: dict) -> bool:
    """True only when the tree looks like an actual material - has a Material
    Output or a recognizable BSDF / emission node. Geometry trees often contain
    bare ShaderNodeMath nodes used for value computation, which alone don't
    constitute something we can render."""
    for data in (tree.get("nodes") or {}).values():
        t = (data or {}).get("type") or ""
        if t == "ShaderNodeOutputMaterial" or t == "ShaderNodeOutputWorld":
            return True
        if "Bsdf" in t or t in ("ShaderNodeEmission", "ShaderNodeBackground", "ShaderNodeHoldout"):
            return True
    return False


def build_material(tree: dict) -> "bpy.types.Material":
    """Build a Material from the tree dict. Best-effort: unknown nodes/sockets are skipped.
    If the tree has no Material Output we add a fallback Principled BSDF + Output so the
    sphere still shows something."""
    mat = bpy.data.materials.new("NodeRunnerPreview")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    node_map: dict[str, "bpy.types.Node"] = {}

    for name, data in (tree.get("nodes") or {}).items():
        node_type = data.get("type")
        if not node_type:
            continue
        try:
            n = nt.nodes.new(node_type)
        except Exception:
            continue
        n.name = name
        loc = data.get("location") or [0, 0]
        if isinstance(loc, dict):
            loc = [loc.get("x", 0), loc.get("y", 0)]
        try:
            n.location = (float(loc[0]) if len(loc) > 0 else 0,
                          float(loc[1]) if len(loc) > 1 else 0)
        except Exception:
            pass

        # Set socket default_values. Prefer name-based lookup when the
        # serialized entry carries a name (Blender 4.x style {name, value}),
        # so version mismatches don't shift values across the wrong sockets.
        # Fall back to positional only for raw scalar/array entries.
        for i, entry in enumerate(data.get("inputs", []) or []):
            if isinstance(entry, dict) and "value" in entry:
                value = entry.get("value")
                sock_name = entry.get("name")
            else:
                value = entry
                sock_name = None
            if value is None:
                continue
            sock = None
            if sock_name:
                sock = n.inputs.get(sock_name)
            if sock is None and i < len(n.inputs) and sock_name is None:
                sock = n.inputs[i]
            if sock is None:
                continue
            try:
                sock.default_value = value
            except Exception:
                continue

        # Set type-specific properties (skip the common ones the addon excludes).
        for key, value in (data.get("properties") or {}).items():
            if key in {
                "color", "height", "hide", "internal_links", "is_active_output",
                "label", "location", "mute", "name", "parent", "select",
                "show_options", "show_preview", "show_texture", "target", "type",
                "use_custom_color", "width", "width_hidden",
            }:
                continue
            try:
                setattr(n, key, value)
            except Exception:
                continue

        node_map[name] = n

    # Wire links (named sockets - bpy looks them up case-sensitively).
    for link in (tree.get("links") or []):
        fn = node_map.get(link.get("fromNode"))
        tn = node_map.get(link.get("toNode"))
        if fn is None or tn is None:
            continue
        try:
            fs = fn.outputs.get(link.get("fromSocket")) or (fn.outputs[0] if fn.outputs else None)
            ts = tn.inputs.get(link.get("toSocket")) or (tn.inputs[0] if tn.inputs else None)
            if fs and ts:
                nt.links.new(fs, ts)
        except Exception:
            continue

    # If we ended up with no Material Output (e.g. tree was partial or all
    # nodes failed to instantiate) add a fallback so the sphere isn't black.
    has_output = any(n.bl_idname == "ShaderNodeOutputMaterial" for n in nt.nodes)
    if not has_output:
        try:
            bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
            bsdf.location = (0, 0)
            out = nt.nodes.new("ShaderNodeOutputMaterial")
            out.location = (300, 0)
            nt.links.new(bsdf.outputs[0], out.inputs[0])
        except Exception:
            pass

    return mat


def main() -> int:
    input_path, output_path = parse_argv()

    try:
        with open(input_path, "r") as f:
            tree = json.load(f)
    except Exception as exc:
        sys.stderr.write(f"failed to read input: {exc}\n")
        return 3

    if not has_shader_nodes(tree):
        sys.stderr.write("NO_SHADER_NODES\n")
        return 6

    try:
        setup_scene()
        mat = build_material(tree)
        sphere = bpy.data.objects.get("PreviewSphere")
        if sphere is None:
            sys.stderr.write("PreviewSphere missing after setup\n")
            return 4
        sphere.data.materials.clear()
        sphere.data.materials.append(mat)

        scene = bpy.context.scene
        scene.render.filepath = output_path
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        bpy.ops.render.render(write_still=True)
    except Exception:
        sys.stderr.write("render failed:\n")
        traceback.print_exc(file=sys.stderr)
        return 5

    return 0


if __name__ == "__main__":
    sys.exit(main())
