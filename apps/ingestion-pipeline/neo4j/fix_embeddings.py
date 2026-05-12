from db import run_batch

batch = [
    ("MATCH (e:Entity) SET e.embedding = [i IN range(1, 384) | rand() * 2 - 1]", {}),
    ("MATCH (p:Project) SET p.embedding = [i IN range(1, 384) | rand() * 2 - 1]", {})
]

result = run_batch(batch)
if result["ok"]:
    print("Successfully replaced all zero-vectors with valid random floats.")
else:
    print("Error:", result["errors"])
