import pytest
import yaml
from pathlib import Path

KB_DIR = Path(__file__).resolve().parent.parent
MANIFESTS_DIR = KB_DIR / "manifests"

def test_source_catalog_consistency():
    cat_file = MANIFESTS_DIR / "source-catalog.yaml"
    assert cat_file.is_file(), "source-catalog.yaml manifest missing"
    
    with open(cat_file, "r", encoding="utf-8") as f:
        catalog = yaml.safe_load(f)
    
    sources = catalog.get("sources", [])
    assert len(sources) > 0, "No sources in catalog manifest"
    
    for s in sources:
        pkg_path = KB_DIR / s["package_path"]
        assert pkg_path.is_dir(), f"Package path {pkg_path} does not exist"
        source_yaml = pkg_path / "source.yaml"
        assert source_yaml.is_file(), f"Missing source.yaml at {pkg_path}"
