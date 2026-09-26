#!/usr/bin/env python3
"""
verify-checksums.py
Verifies SHA-256 hashes of all original source documents in the knowledge base.
"""

import os
import sys
import hashlib
from pathlib import Path

def compute_sha256(file_path):
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()

def main():
    root_dir = Path(__file__).resolve().parent.parent
    sources_dir = root_dir / "sources"
    manifests_dir = root_dir / "manifests"

    checked = 0
    failures = 0

    print("=" * 60)
    print("Verifying Knowledge Base SHA-256 Checksums")
    print("=" * 60)

    # 1. Check local checksum.sha256 files in version original directories
    for checksum_file in sources_dir.glob("**/checksum.sha256"):
        version_dir = checksum_file.parent
        original_dir = version_dir / "original"
        
        if not original_dir.is_dir():
            print(f"[WARN] No original/ folder for checksum {checksum_file}")
            continue

        with open(checksum_file, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]

        for line in lines:
            parts = line.split(maxsplit=1)
            if len(parts) != 2:
                continue
            expected_hash, fname = parts[0], parts[1].strip()
            # Clean possible * prefix (binary mode in sha256sum)
            if fname.startswith("*"):
                fname = fname[1:]
            
            target_path = original_dir / fname
            if not target_path.is_file():
                # Try finding any pdf if filename differs slightly
                pdfs = list(original_dir.glob("*.pdf"))
                if pdfs:
                    target_path = pdfs[0]
                else:
                    print(f"[FAIL] Missing target file '{fname}' in {original_dir}")
                    failures += 1
                    continue

            checked += 1
            actual_hash = compute_sha256(target_path)
            if actual_hash.lower() == expected_hash.lower():
                print(f"[OK] {target_path.relative_to(root_dir)} (SHA-256 match)")
            else:
                print(f"[FAIL] Checksum mismatch for {target_path.relative_to(root_dir)}")
                print(f"       Expected: {expected_hash}")
                print(f"       Actual:   {actual_hash}")
                failures += 1

    print("=" * 60)
    print(f"Total Files Verified: {checked}")
    print(f"Total Checksum Failures: {failures}")
    print("=" * 60)

    sys.exit(0 if failures == 0 else 1)

if __name__ == "__main__":
    main()
