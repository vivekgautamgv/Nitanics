# Contracts

Interface contracts defining what downstream components expect from Component 01.

## Files

| Contract | Consumer | What It Defines |
|----------|----------|-----------------|
| `graph-studio-contract.md` | Component 02 (Graph Studio) | Neo4j schema, node types, queries needed |
| `mcp-contract.md` | Component 04 (MCP) | Skills → tools mapping, pipeline functions |

## Rules
- Do not close Component 01 without finalizing these contracts.
- If a downstream component needs something not in the contract, add it here first.
- Contract changes after Component 01 is CLOSED require reopening + justification.
