import pytest
import yaml
from pathlib import Path

KB_DIR = Path(__file__).resolve().parent.parent
SOURCES_DIR = KB_DIR / "sources"

def get_source_yamls():
    return list(SOURCES_DIR.glob("**/source.yaml"))

def test_source_packages_exist():
    sources = get_source_yamls()
    assert len(sources) > 0, "No source.yaml packages found"

@pytest.mark.parametrize("source_yaml", get_source_yamls(), ids=lambda p: p.parent.name)
def test_source_yaml_structure(source_yaml):
    with open(source_yaml, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    assert isinstance(data, dict), f"{source_yaml} must be a valid YAML dictionary"
    
    # Required top-level fields
    for field in ["source_id", "title", "source_type", "jurisdiction", "issuing_authority"]:
        assert field in data and data[field], f"Missing required field '{field}' in {source_yaml}"
    
    assert data["jurisdiction"] in {"india", "international"}, f"Invalid jurisdiction in {source_yaml}"
    assert data["source_type"] in {
        "statute", "rule", "treaty", "pharmacopoeial-standard",
        "registry-record", "case-law", "guideline", "notification"
    }, f"Invalid source_type in {source_yaml}"
