# Design.md — Visual Design System
# IP-SAKTI Sahayak | SIH 2026

---

## 1. Brand & Design Vibe

IP-SAKTI Sahayak should look like a **trustworthy, institutional research/legal/regulatory tool**, not a flashing, neon AI SaaS wrapper.
- **Aesthetic:** Minimalist, clean, structured, and authoritative.
- **Tone:** Professional, clear, and reassuring—suited for presenting directly to the Ministry of AYUSH.
- **Color philosophy:** Colors are used deliberately to convey status, confidence level, and jurisdiction, rather than for decorative decoration.

---

## 2. Color Palette (Dark-Theme Core)

All custom palette variables are declared globally in `src/index.css`:

### Brand Base Accent
- `--primary`: Saffron accent (`#D97706`). Used for highlights, logo accents, main CTA buttons, and the active India toggle indicator.
- `--secondary`: Emerald accent (`#065F46`). Conveying herbs, Ayurveda, and trust. Used in citation cards and green accent layers.

### Background Hierarchy
- `--bg-primary`: `#0A0F0D` (Almost black, dark green-tinted body foundation).
- `--bg-surface`: `#111814` (Deep background for elements like cards, feature highlights, and chat blocks).
- `--bg-elevated`: `#1A241E` (Lighter panels, search fields, active settings, and user chat bubbles).
- `--bg-border`: `#2A3830` (Muted borders dividing functional elements).

### Document Typography
- `--text-primary`: `#F0FDF4` (Near-white text with a fresh green tint for maximum readability).
- `--text-secondary`: `#86EFAC` (Medium light green for secondary labels, stats, list titles).
- `--text-muted`: `#4B5563` (Muted charcoal-gray for legends, inactive selections, system notes).

### Semantic Badges
- `--confidence-high`: `#22C55E` (Green pill).
- `--confidence-medium`: `#F59E0B` (Amber pill).
- `--confidence-low`: `#EF4444` (Red pill).
- `--india-badge`: `#FF9933` (India flag orange).
- `--intl-badge`: `#3B82F6` (International blue).
- `--disclaimer`: `#6366F1` (Muted blue-purple).

---

## 3. Typography Rules

Fonts are loaded asynchronously from Google Fonts in `index.html`:

| Text Category | Font Family | Font Weight | Default Size |
|---------------|-------------|-------------|--------------|
| Major Titles & Headings | Sora | 700 (Bold) | `2.5rem` to `4.5rem` |
| Subheadings & Labels | Sora | 500 (Medium) | `1.1rem` to `1.5rem` |
| Primary Body Text | Sora | 400 (Regular) | `0.95rem` to `1rem` |
| Statutes, Citations, & Code | JetBrains Mono | 400 (Regular) | `0.8rem` to `0.85rem` |
| Devanagari Scripts (Hindi) | Noto Sans Devanagari | 400 (Regular) | `1rem` |

- **Line spacing:** Always keep body lines at `1.6` to `1.65` for optimal readability.
- **Mono integration:** Use monospaced fonts to format official citations, database keys, and links.

---

## 4. UI Component Specifications

### User Chat Bubble (`.user-bubble`)
- **Background:** Solid `--bg-elevated` panels.
- **Borders:** `1px solid var(--bg-border)`.
- **Radii:** `16px 16px 4px 16px` (makes the bottom-right corner point toward the user's avatar icon).
- **Max Width:** Restrained to `70%` of viewport width to maintain structured dialogue channels.

### AI Chat Bubble (`.ai-bubble`)
- **Background:** Subtle dark gradient: `linear-gradient(135deg, var(--bg-surface), var(--bg-elevated))`.
- **Borders:** `1px solid rgba(52, 211, 153, 0.2)` (emerald tint).
- **Radii:** `4px 16px 16px 16px` (makes the top-left corner point toward the AI's leaf avatar).
- **Max Width:** Up to `80%` of viewport space to hold citations comfortably.

### Citation Card (`.citation-card`)
- **Background:** Translucent emerald wash `rgba(6, 95, 70, 0.25)`.
- **Left Margin:** Highlighted with a `3px solid var(--secondary-light)` vertical accent border.
- **Fonts:** Displayed in `JetBrains Mono` for structured legal documentation.
- **Interactions:** Triggers mouse animations where Hover slides the card right by 3px and highlights link anchors.

### Toggle Controls (`.jurisdiction-toggle`)
- **Layout:** Sliding pill pill toggle.
- **Active State Highlights:**
  - *India active:* Amber glow on toggle handle.
  - *International active:* Blue glow on toggle handle.

### Disclaimer Notice (`.disclaimer`)
- **Style:** Displayed in a semi-opaque indigo box below the message text blocks.
- **Goal:** Maintains an explicit reminder that the tool provides information only, not professional legal advice.

---

## 5. Interaction & Animation Rules

Avoid distracting, hyperactive transition components. Use simple, direct indicators:
- **Message Arrivals:** Trigger a simple transition of `0.2s duration` sliding upwards by 16px while transparency transitions from 0 to 1.
- **Confidence Badges:** The confidence score pill executes a single 1-second scale pulsate when rendering to emphasize reliability.
- **Background Particles:** Floating herb emoji elements move slowly using low opacity (`0.06` to `0.12`) keyframe translation to keep the backdrop calm.
- **Typewriter Speed:** Simulates typing character-by-character at 70ms with a cursor blink frequency matching `1s`.
