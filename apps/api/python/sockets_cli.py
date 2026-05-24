#!/usr/bin/env python3
"""Dump INPUT_NAMES / OUTPUT_NAMES from the upstream node_runner package as JSON.

Companion to convert_cli.py. The web API uses this to label input/output sockets
in the node inspector by their real names instead of just indices.

Output: {"inputs": {nodeType: [...names]}, "outputs": {nodeType: [...names]}}
"""
from __future__ import annotations

import json
import os
import sys

NODE_RUNNER_DIR = os.environ.get("NODE_RUNNER_PYTHON_PATH")
if NODE_RUNNER_DIR:
    sys.path.insert(0, os.path.dirname(NODE_RUNNER_DIR.rstrip("/")))
else:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))


def main() -> int:
    try:
        from node_runner.node_data import INPUT_NAMES, OUTPUT_NAMES  # type: ignore[import-not-found]
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}))
        return 1

    sys.stdout.write(json.dumps({
        "ok": True,
        "inputs": INPUT_NAMES,
        "outputs": OUTPUT_NAMES,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
