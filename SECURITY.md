# Security Policy

## Supported Versions

Currently only the `main` branch (and actively maintained release tracks) receive security updates.

| Version | Supported          |
| ------- | ------------------ |
| v0.1.0  | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take the security of Nitanics very seriously. If you have discovered an issue that you believe to be a security vulnerability, please follow these guidelines to disclose it to our team.

1. **Do not open a public issue.** Please avoid discussing vulnerabilities publicly on GitHub.
2. Email the repository owner or security contact directly with a description of the vulnerability.
3. Provide descriptive steps to reproduce the vulnerability. This will allow us to assess the impact and implement a patch effectively.
4. We aim to acknowledge vulnerability reports within 48 hours and typically release patches within a standard coordinated disclosure timeframe.

### Scope

Since the project handles Neo4j Graph queries natively (specifically exposing an `mcp` endpoint and `api` bridging logic), please explicitly report any vulnerabilities relating to:
* Unintended Cypher Injection or bypass.
* Unauthenticated exposure of graph endpoints.
* Misconfigurations in `.env` extraction scripts (`ensure-neo4j.mjs`).

Any disclosures following this policy are greatly appreciated!
