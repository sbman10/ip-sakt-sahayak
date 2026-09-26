# OCR & Text Extraction Policy

## 1. Strict Separation of Raw & Derived Content
Extracted text, whether from programmatic PDF stream parsing or Optical Character Recognition (OCR), is **derived material** and must reside under:
`knowledge-base/derived/extracted-text/<jurisdiction>/`

Under no circumstances should extracted text overwrite or replace original PDF binaries in `sources/`.

## 2. OCR Standards
- Engine: Tesseract 5.x or PaddleOCR with English and Devanagari language packs.
- Minimum Resolution: 300 DPI.
- Layout Preservation: Chapter, section, and sub-clause headers must be preserved with clear markup tags.
- Quality Check: Any extracted text chunk with an estimated OCR confidence score < 85% must be flagged for manual transcription.
