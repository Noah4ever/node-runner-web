#!/usr/bin/env python3
"""CLI bridge between the Node Runner web API and the upstream Python encoder.

Reads a JSON request from stdin, runs decode_as/encode_as from the bundled
node_runner package, and writes a JSON response to stdout. Errors are
returned as {"ok": false, "error": "..."} so the API can surface them.

Request:  {"input": "...", "sourceFormat": "json", "targetFormat": "hash"}
Response: {"ok": true, "output": "..."} | {"ok": false, "error": "..."}
"""
from __future__ import annotations

import json
import os
import sys
import traceback

NODE_RUNNER_DIR = os.environ.get("NODE_RUNNER_PYTHON_PATH")
if NODE_RUNNER_DIR:
    sys.path.insert(0, os.path.dirname(NODE_RUNNER_DIR.rstrip("/")))
else:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def normalize_js_tree(tree):
    """Translate the JS/API-facing tree shape into the Python-native shape that
    encoding.py's compact / encode functions expect.

    Differences this handles:
      - links use camelCase keys (fromNode/fromSocket/toNode/toSocket) instead
        of snake_case (from_node/from_socket/to_node/to_socket)
      - location is a {x, y} object instead of a [x, y] array
      - properties live in a separate `properties` dict instead of being
        inlined alongside type / label / location
      - inputs may be `{name, value}` wrappers; the Python encoder expects raw
        values at each positional index (it skips defaults by index)

    Idempotent - if the input already looks Python-native it's returned as-is.
    """
    if not isinstance(tree, dict):
        return tree
    nodes_in = tree.get("nodes")
    links_in = tree.get("links")
    if not isinstance(nodes_in, dict) or not isinstance(links_in, list):
        return tree

    nodes_out = {}
    for name, n in nodes_in.items():
        if not isinstance(n, dict):
            continue
        loc = n.get("location")
        if isinstance(loc, dict) and ("x" in loc or "y" in loc):
            loc = [loc.get("x", 0), loc.get("y", 0)]
        elif loc is None:
            loc = [0, 0]
        new_n = {
            "type": n.get("type", ""),
            "name": n.get("name", name),
            "label": n.get("label", ""),
            "location": loc,
        }
        if n.get("parent"):
            new_n["parent"] = n["parent"]

        # Unwrap {name, value} input wrappers to plain positional values.
        raw_inputs = n.get("inputs", []) or []
        out_inputs = []
        for entry in raw_inputs:
            if isinstance(entry, dict) and "value" in entry:
                out_inputs.append(entry["value"])
            else:
                out_inputs.append(entry)
        new_n["inputs"] = out_inputs

        raw_outputs = n.get("outputs", []) or []
        out_outputs = []
        for entry in raw_outputs:
            if isinstance(entry, dict) and "value" in entry:
                out_outputs.append(entry["value"])
            else:
                out_outputs.append(entry)
        new_n["outputs"] = out_outputs

        # Flatten properties dict into the node itself - that's where
        # _compact_data scans for non-fixed-field keys.
        props = n.get("properties") or {}
        if isinstance(props, dict):
            for k, v in props.items():
                if k not in new_n:
                    new_n[k] = v

        nodes_out[name] = new_n

    links_out = []
    for link in links_in:
        if not isinstance(link, dict):
            continue
        if "from_node" in link and "to_node" in link:
            links_out.append(link)
            continue
        links_out.append({
            "from_node": link.get("fromNode", link.get("from_node", "")),
            "to_node": link.get("toNode", link.get("to_node", "")),
            "from_socket": link.get("fromSocket", link.get("from_socket", "")),
            "to_socket": link.get("toSocket", link.get("to_socket", "")),
        })

    out = dict(tree)
    out["nodes"] = nodes_out
    out["links"] = links_out
    return out


def main() -> int:
    try:
        raw = sys.stdin.read()
        req = json.loads(raw)
        source = req["sourceFormat"]
        target = req["targetFormat"]
        payload = req["input"]
    except Exception as exc:  # noqa: BLE001
        _emit({"ok": False, "error": f"invalid request: {exc}"})
        return 1

    try:
        from node_runner import encoding  # type: ignore[import-not-found]
    except Exception as exc:  # noqa: BLE001
        _emit({"ok": False, "error": f"node_runner module not importable: {exc}"})
        return 1

    try:
        # The TS side uses lowercase format names; the Python module uses uppercase
        # constants (FORMAT_HASH = "HASH", etc.).
        source_norm = source.upper() if isinstance(source, str) else source
        target_norm = target.upper() if isinstance(target, str) else target
        if source_norm == target_norm:
            _emit({"ok": True, "output": payload})
            return 0
        data = encoding.decode_as(payload, source_norm)
        # When the source was JSON, the payload might be in the JS/API-facing
        # shape (camelCase links, {x,y} locations, {name,value} input wrappers).
        # encoding.py's encoders only understand the Python-native shape, so
        # normalize before re-encoding.
        if source_norm == "JSON":
            data = normalize_js_tree(data)
        out = encoding.encode_as(data, target_norm)
        _emit({"ok": True, "output": out})
        return 0
    except Exception as exc:  # noqa: BLE001
        _emit({"ok": False, "error": f"{type(exc).__name__}: {exc}", "trace": traceback.format_exc()})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
