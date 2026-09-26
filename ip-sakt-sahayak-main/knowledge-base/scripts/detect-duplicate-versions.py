#!/usr/bin/env python3
"""
detect-duplicate-versions.py
Ensures uniqueness of source IDs, package directory names, and version labels across all sources.
"""

import os
import sys
import yaml
from pathlib import Path
from collections import defaultdict

def main():
    root_dir = Path(__file__).resolve().parent.parent
    sources_dir = root_dir / "sources"

    source_ids = defaultdict(list)
    version_keys = defaultdict(list)
    errors = []

    for pkg_dir in sources_dir.glob("**/*"):
        source_yaml = pkg_dir / "source.yaml"
        if source_yaml.is_file():
            with open(source_yaml, "r", encoding="utf-8") as f:
                s_data = yaml.safe_load(f) or {}
            
            s_id = s_data.get("source_id")
            rel_pkg = pkg_dir.relative_to(root_dir).as_posix()

            if not s_id:
                errors.append(f"Package at {rel_pkg} has no source_id defined.")
                continue

            source_ids[s_id].append(rel_pkg)

            # Check versions
            versions_dir = pkg_dir / "versions"
            if versions_dir.is_dir():
                for v_dir in versions_dir.iterdir():
                    if v_dir.is_dir():
                        v_label = v_dir.name
                        composite_key = f"{s_id}::{v_label}"
                        version_keys[composite_key].append(v_dir.relative_to(root_dir).as_posix())

    print("=" * 60)
    print("Checking for Duplicate Source IDs and Version Identifiers")
    print("=" * 60)

    # Check duplicate source_ids
    for s_id, paths in source_ids.items():
        if len(paths) > 1:
            errors.append(f"Duplicate source_id '{s_id}' found in multiple packages: {paths}")

    # Check duplicate versions
    for v_key, paths in version_keys.items():
        if len(paths) > 1:
            errors.append(f"Duplicate version identifier '{v_key}' found in: {paths}")

    if errors:
        print("[FAIL] Conflicts found:")
        for err in errors:
            print(f"       - {err}")
        sys.exit(1)
    else:
        print(f"[PASS] All {len(source_ids)} source IDs and {len(version_keys)} version labels are unique.")
        sys.exit(0)

if __name__ == "__main__":
    main()
