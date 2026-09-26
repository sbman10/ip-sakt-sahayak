import pytest
import yaml
import hashlib
from pathlib import Path

KB_DIR = Path(__file__).resolve().parent.parent
SOURCES_DIR = KB_DIR / "sources"

def compute_sha256(path):
    sha = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()

def get_current_yamls():
    return list(SOURCES_DIR.glob("**/current.yaml"))

@pytest.mark.parametrize("current_yaml", get_current_yamls(), ids=lambda p: p.parent.name)
def test_current_version_exists(current_yaml):
    with open(current_yaml, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    assert "current_version" in data, f"Missing 'current_version' in {current_yaml}"
    ver_label = str(data["current_version"])
    
    pkg_dir = current_yaml.parent
    ver_dir = pkg_dir / "versions" / ver_label
    assert ver_dir.is_dir(), f"Target current version dir {ver_dir} does not exist"
    
    # Verify metadata.yaml exists in version
    meta_path = ver_dir / "metadata.yaml"
    assert meta_path.is_file(), f"Missing metadata.yaml in {ver_dir}"
    
    # Verify checksum if original pdf present
    orig_dir = ver_dir / "original"
    if orig_dir.is_dir():
        pdfs = list(orig_dir.glob("*.pdf"))
        if pdfs:
            pdf_path = pdfs[0]
            checksum_file = ver_dir / "checksum.sha256"
            assert checksum_file.is_file(), f"Missing checksum.sha256 for {pdf_path}"
            with open(checksum_file, "r", encoding="utf-8") as cf:
                expected_hash = cf.read().split()[0]
            actual_hash = compute_sha256(pdf_path)
            assert actual_hash.lower() == expected_hash.lower(), f"Checksum mismatch for {pdf_path}"
