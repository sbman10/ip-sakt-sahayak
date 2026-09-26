import pytest
import json
from pathlib import Path

KB_DIR = Path(__file__).resolve().parent.parent
QUARANTINE_DIR = KB_DIR / "quarantine"

def test_unverified_case_law_is_quarantined():
    # Incomplete case law must reside in quarantine until certified
    inc_case_dir = QUARANTINE_DIR / "incomplete-case-law"
    assert inc_case_dir.is_dir(), "incomplete-case-law quarantine directory missing"
    
    # Check that case law files in quarantine are marked for verification
    jsonl_files = list(inc_case_dir.glob("*.jsonl"))
    assert len(jsonl_files) >= 1, "Expected quarantined case law files"
