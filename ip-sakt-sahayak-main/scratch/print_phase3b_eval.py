import json

with open("reports/qdrant_phase_3b_evaluation.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Decision: {data['decision']}")
print(f"Notes: {data['decision_notes']}")
print(f"Summary Metrics: {data['summary_metrics']}")
print("-" * 80)
for e in data["evaluations"]:
    if e["is_out_of_scope"]:
        print(f"{e['query_id']} [OOS]: Safe={e['metrics']['out_of_scope_safe']} TopDoc={e['qdrant_filtered_top_k'][0]['document_id']}")
    else:
        top_sec = e['qdrant_filtered_top_k'][0]['section'] if e['qdrant_filtered_top_k'] else "None"
        top_doc = e['qdrant_filtered_top_k'][0]['document_id'] if e['qdrant_filtered_top_k'] else "None"
        r1 = e['metrics']['correct_section_at_rank_1']
        t5 = e['metrics']['correct_section_in_top_5']
        exp = e['expected_sections']
        print(f"{e['query_id']}: R1={r1} T5={t5} | Top: {top_sec} ({top_doc}) | Exp: {exp}")
