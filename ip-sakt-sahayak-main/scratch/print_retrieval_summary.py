import json

with open('reports/phase3b_retrieval_audit.json', encoding='utf-8') as f:
    d = json.load(f)

for q in list(d.keys())[:1]:
    data = d[q]
    print('========================================================')
    print('QUERY:', q)
    for mode in ['dense_top10', 'sparse_top10', 'hybrid_top10']:
        print(f'\n--- {mode.upper()} ---')
        for h in data[mode]:
            print(f"Rank {h['rank']:2d} | Score: {h['score']:.4f} | Section: {h['section']:<16} | Doc: {h['document_id']:<24} | Chunk: {h['chunk_id']}")
