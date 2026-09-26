#!/usr/bin/env python3
"""
validate-source-metadata.py
Validates all source.yaml, current.yaml, and version metadata.yaml files in the knowledge base.
Ensures conformance with required fields, data types, and controlled vocabularies.
"""

import os
import sys
import yaml
from pathlib import Path

VALID_JURISDICTIONS = {"india", "international"}
VALID_SOURCE_TYPES = {
    "statute", "rule", "treaty", "pharmacopoeial-standard",
    "registry-record", "case-law", "guideline", "notification"
}
VALID_VERIFICATION_STATUSES = {"verified", "pending-review", "unverified", "rejected"}
VALID_VERSION_TYPES = {"original", "amendment", "re-enactment", "revision", "erratum"}

def load_yaml(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f), None
    except Exception as e:
        return None, str(e)

def validate_source_yaml(path):
    errors = []
    data, err = load_yaml(path)
    if err:
        return [f"YAML Parse Error: {err}"]
    if not isinstance(data, dict):
        return ["Root element must be a dictionary"]

    # Required fields
    required = ["source_id", "title", "source_type", "jurisdiction", "issuing_authority"]
    for req in required:
        if req not in data or not data[req]:
            errors.append(f"Missing required field: '{req}'")

    if "jurisdiction" in data and data["jurisdiction"] not in VALID_JURISDICTIONS:
        errors.append(f"Invalid jurisdiction '{data['jurisdiction']}'. Must be one of {VALID_JURISDICTIONS}")

    if "source_type" in data and data["source_type"] not in VALID_SOURCE_TYPES:
        errors.append(f"Invalid source_type '{data['source_type']}'. Must be one of {VALID_SOURCE_TYPES}")

    status = data.get("verification_status", "pending-review")
    if status not in VALID_VERIFICATION_STATUSES:
        errors.append(f"Invalid verification_status '{status}'. Must be one of {VALID_VERIFICATION_STATUSES}")

    if status == "verified":
        v_rec = data.get("verification_record")
        if not v_rec or not isinstance(v_rec, dict):
            errors.append("Status is 'verified' but 'verification_record' is missing or not a dictionary")
        else:
            for v_req in ["verified_by", "verified_date", "evidence_document"]:
                if v_req not in v_rec:
                    errors.append(f"Missing verification_record field: '{v_req}'")

    return errors

def validate_current_yaml(path):
    errors = []
    data, err = load_yaml(path)
    if err:
        return [f"YAML Parse Error: {err}"]
    if not isinstance(data, dict):
        return ["Root element must be a dictionary"]

    if "source_id" not in data or not data["source_id"]:
        errors.append("Missing required field: 'source_id'")
    if "current_version" not in data or not data["current_version"]:
        errors.append("Missing required field: 'current_version'")

    return errors

def validate_version_metadata(path):
    errors = []
    data, err = load_yaml(path)
    if err:
        return [f"YAML Parse Error: {err}"]
    if not isinstance(data, dict):
        return ["Root element must be a dictionary"]

    required = ["source_id", "version_label", "version_type"]
    for req in required:
        if req not in data or not data[req]:
            errors.append(f"Missing required field: '{req}'")

    v_type = data.get("version_type")
    if v_type and v_type not in VALID_VERSION_TYPES:
        errors.append(f"Invalid version_type '{v_type}'. Must be one of {VALID_VERSION_TYPES}")

    return errors

def main():
    root_dir = Path(__file__).resolve().parent.parent
    sources_dir = root_dir / "sources"
    
    total_packages = 0
    total_errors = 0

    print("=" * 60)
    print(f"Validating Knowledge Base Metadata in {sources_dir}")
    print("=" * 60)

    for pkg_dir in sources_dir.glob("**/*"):
        source_yaml = pkg_dir / "source.yaml"
        if source_yaml.is_file():
            total_packages += 1
            rel_path = source_yaml.relative_to(root_dir)
            pkg_errors = []

            # 1. Validate source.yaml
            pkg_errors.extend(validate_source_yaml(source_yaml))

            # 2. Validate current.yaml
            current_yaml = pkg_dir / "current.yaml"
            if not current_yaml.is_file():
                pkg_errors.append("Missing current.yaml pointer file")
            else:
                pkg_errors.extend(validate_current_yaml(current_yaml))
                curr_data, _ = load_yaml(current_yaml)
                if curr_data and "current_version" in curr_data:
                    ver_dir = pkg_dir / "versions" / str(curr_data["current_version"])
                    if not ver_dir.is_dir():
                        pkg_errors.append(f"Current version target '{curr_data['current_version']}' directory does not exist at {ver_dir}")

            # 3. Validate version metadata
            versions_dir = pkg_dir / "versions"
            if versions_dir.is_dir():
                for v_dir in versions_dir.iterdir():
                    if v_dir.is_dir():
                        v_meta = v_dir / "metadata.yaml"
                        if not v_meta.is_file():
                            pkg_errors.append(f"Missing metadata.yaml in version directory '{v_dir.name}'")
                        else:
                            pkg_errors.extend(validate_version_metadata(v_meta))

            if pkg_errors:
                total_errors += len(pkg_errors)
                print(f"[FAIL] {rel_path}:")
                for err in pkg_errors:
                    print(f"       - {err}")
            else:
                print(f"[PASS] {rel_path}")

    print("=" * 60)
    print(f"Total Packages Validated: {total_packages}")
    print(f"Total Validation Errors: {total_errors}")
    print("=" * 60)

    sys.exit(0 if total_errors == 0 else 1)

if __name__ == "__main__":
    main()
