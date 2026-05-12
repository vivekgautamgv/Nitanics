from db import run_cypher, run_batch

print("Cleaning up old duplicate collections and projects...")

projects = ["gsb-research", "hebbia-financial", "kotak-market-2026", "santander-outlook",
    "fitgap-software", "third-bridge", "motilal-oswal", "icici-strategy",
    "guru-technical", "union-mf", "generali-life", "axis-bank",
    "guru-it-sector", "guru-it-sector-2", "motilal-defence", "cfs-us-equity",
    "aws-strategy", "jp-morgan-compass", "naga-nasdaq", "jp-morgan-reports",
    "picton-recovery", "sbi-digest", "neuberger-berman", "kotak-strategy",
    "morgan-harbor", "nuveen-survey", "fidelity-allocation", "hdfc-market"]

batch = [
    ("MATCH (c:Collection {name: 'Equity Research Part - 2'}) OPTIONAL MATCH (c)<-[:BELONGS_TO]-(p:Project) DETACH DELETE c, p", {}),
    ("MATCH (e:Entity) WHERE e.name = 'Global Equities' OR e.name STARTS WITH 'Document_' OR e.projectCount < 2 DETACH DELETE e", {}),
    ("MATCH (te:TemporalEvent) WHERE te.projectId IN $pids DETACH DELETE te", {"pids": projects}),
    ("MATCH (cc:CausalChain) WHERE cc.projectId IN $pids DETACH DELETE cc", {"pids": projects})
]
run_batch(batch)
print("Cleanup complete!")
