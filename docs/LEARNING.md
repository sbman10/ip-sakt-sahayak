# LEARNING.md — Team Training Journal
# IP-SAKTI Sahayak | SIH 2026

Welcome to the learning journal! The goal of this document is to ensure that while we build IP-SAKTI Sahayak using AI assistance, we fully understand *what* we are building and *how* the underlying technologies work. 

---

## 1. What is RAG? (Retrieval-Augmented Generation)

**Analogy (The Open-Book Exam):**
Imagine you have to take an exam on traditional Ayurvedic licensing policies. 
* **Normal LLM (GPT, Gemini without RAG):** You are sitting in the exam hall with your phone locked away. You have to answer purely from your brain's memory. If you forget the exact text of Section 3(p) of the Patents Act, you might guess or hallucinate (make up something that sounds believable but is false).
* **RAG System:** You are given an open book containing all the acts, policies, and regulations. Whenever a question is asked, you check the index, find the exact page, read the text, and write down an answer based *only* on that page, citing the page number.

**In Computer Terms:**
```
                     ┌──────────────────┐
                     │   User Query     │
                     └────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Semantic Search  │
                    │   (Vector DB)     │
                    └────────┬─────────┘
                             │ Top Chunks
                    ┌────────▼─────────┐
                    │  LLM Context     │
                    │  Prompt Engine   │
                    └────────┬─────────┘
                             │ Grounded Answer
                     ┌───────▼──────────┐
                     │   User Screens   │
                     └──────────────────┘
```

RAG keeps our assistant grounded in reality and stops it from fabricating legal text.

---

## 2. Dynamic Terms We Need to Master

### Vector Embeddings (Sankalp Aur Vectors)
* **What is it?** Match standard words to math values (coordinates).
* **Easy Explanation:** Imagine a map where coordinates dictate meanings. Words like `Neem`, `Tulsi`, and `Haldi` will cluster close to each other. Under the hood, the computer converts:
  *"How can I register my Ayurvedic toothpaste?"* ➔ `[0.12, -0.45, 0.88, ... 384 dimensions]`.
* **Mental Model (Hinglish):** Vector map par meaning ke according variables drop hote hain. "Patents" aur "Section 3(p)" pass-pass honge, jabki "Cricket" bahut dur hoga.

### Similarity Search (Cosine Similarity)
* **What is it?** Measuring angles between vectors to select matches.
* **Easy Explanation:** Checking if two questions talk about the same legal context despite using different synonyms (e.g. *"herbal treatment"* vs *"botanical formulation"*).

### Chunking
* **What is it?** Splitting dense PDF pages into search-sized blocks.
* **Easy Explanation:** If we throw a 600-page book at a model, it takes too long to search and costs too much to process. We slice it into **500-token blocks** with a **50-token overlap**.
* **Why the overlap?** If a crucial rule is split exactly in half by page boundaries, the context shifts. The overlap ensures continuity.

---

## 3. Recommended Study Paths for Our Team

To build this successfully, different team members should focus on different aspects:

1. **Frontend Team:** 
   - Learn how React states manage live events and lists.
   - Master CSS Flexbox and Grid layouts.
2. **Backend/Data Team:**
   - Understand how Python packages parse files (`PyMuPDF`).
   - Learn about local database CRUD methods in ChromaDB.
3. **AI Pipeline Team:**
   - Study HuggingFace embedding APIs and model size trade-offs.
   - Trace prompt constraints inside model contexts to prevent hallucinated answers.

---

## 4. Visual Hygiene in Institutional Interfaces

* **Key Concept:** Cognitive ergonomics & contrast hygiene.
* **Why simplify backgrounds?** In consumer startups, heavy animation and parallax glows catch short attention spans. But in administrative, judicial, or regulatory portals (like the Ministry of AYUSH), busy background particles create high visual noise. This:
  - distracts users who are carefully reading dense legal sections.
  - degrades contrast readability, rendering small text fuzzy.
  - consumes CPU power on older computers because animating dozens of items causes re-reflow processes.
* **Analogy (The clean table):** Apne study table par kaam karte waqt agar space bilkul empty aur clean ho to concentration banana easy hota hai. Floating objects table par distractions ke siwa kuch nahi hote.

