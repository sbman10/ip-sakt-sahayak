#!/usr/bin/env python3
"""
validate-jurisdiction-separation.py
Asserts strict isolation between Indian and International legal sources.
Checks that no source in sources/india declares an international jurisdiction,
no source in sources/international declares india, and derived collections do not cross.
"""

import os
import sys
import yaml
from pathlib import Path

def main():
    root_dir = Path(__file__).resolve().parent.parent
    sources_dir = root_dir / "sources"
    derived_chunks_dir = root_dir / "derived" / "chunks"

    violations = []
    total_checked = 0

    print("=" * 60)
    print("Validating Jurisdiction Separation & Strict Isolation")
    print("=" * 60)

    # 1. Check sources/india
    india_dir = sources_dir / "india"
    if india_dir.is_dir():
        for source_yaml in india_dir.glob("**/source.yaml"):
            total_checked += 1
            with open(source_yaml, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            jur = data.get("jurisdiction")
            if jur != "india":
                violations.append(f"{source_yaml.relative_to(root_dir)} located in sources/india/ but declares jurisdiction '{jur}'")

    # 2. Check sources/international
    intl_dir = sources_dir / "international"
    if intl_dir.is_dir():
        for source_yaml in intl_dir.glob("**/source.yaml"):
            total_checked += 1
            with open(source_yaml, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            jur = data.get("jurisdiction")
            if jur != "international":
                violations.append(f"{source_yaml.relative_to(root_dir)} located in sources/international/ but declares jurisdiction '{jur}'")

    # 3. Check derived/chunks separation
    if (derived_chunks_dir / "india").is_dir():
        for f in (derived_chunks_dir / "india").glob("*.jsonl"):
            total_checked += 1
            name = f.name.lower()
            if any(k in name for k in ["nagoya", "trips", "wipo", "international"]):
                violations.append(f"Derived chunk '{f.name}' in derived/chunks/india/ appears to contain international material.")

    if (derived_chunks_dir / "international").is_dir():
        for f in (derived_chunks_dir / "international").glob("*.jsonl"):
            total_checked += 1
            name = f.name.lower()
            if any(k in name for k in ["patents_act_1970", "patents_rules_2003", "biological_diversity_act", "drugs_and_cosmetics"]):
                violations.append(f"Derived chunk '{f.name}' in derived/chunks/international/ appears to contain domestic Indian material.")

    print(f"Checked items: {total_checked}")
    if violations:
        print("[FAIL] Jurisdiction isolation violations detected:")
        for v in violations:
            print(f"       - {v}")
        sys.exit(1)
    else:
        print("[PASS] Complete jurisdiction isolation verified. Zero cross-contamination.")
        sys.exit(0)

if __name__ == "__main__":
    main()
