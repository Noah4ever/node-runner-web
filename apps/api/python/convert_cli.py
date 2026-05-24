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
        out = encoding.encode_as(data, target_norm)
        _emit({"ok": True, "output": out})
        return 0
    except Exception as exc:  # noqa: BLE001
        _emit({"ok": False, "error": f"{type(exc).__name__}: {exc}", "trace": traceback.format_exc()})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
