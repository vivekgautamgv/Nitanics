# Technology Extraction Skill

Domain-specific guidance for extracting knowledge graphs from technology and software content.
This skill is ADDITIVE — it maps domain concepts to existing categories.
It does NOT change the extraction format, schema, or validation rules.

---

## 1. Domain Overview

What makes technology content distinctive for knowledge graph extraction:
- **Systems have layers.** Hardware → OS → runtime → framework → application. Extract the layer that matters for the argument.
- **Dependencies are the architecture.** What depends on what IS the system. DEPENDS_ON relationships are the most important.
- **Standards enable interop.** Protocols, APIs, file formats — these are the invisible glue. Extract them when the text discusses compatibility or integration.
- **Evolution replaces predecessors.** Technology changes fast. Extract REPLACES and PRECEDES relationships to capture evolution.

Common source types: technical papers, architecture documents, API documentation, system design docs, post-mortems, industry analysis.

---

## 2. Entity Mapping

| Domain Concept | Category | Why | Example |
|---------------|----------|-----|---------|
| Programming language | Technology | Technical tool | "Python", "Rust", "TypeScript" |
| Framework / library | Technology | Building block | "React", "Neo4j", "TensorFlow" |
| Protocol / standard | Technology | Interface specification | "HTTP/2", "gRPC", "OAuth 2.0" |
| API / service | Technology | Callable interface | "Stripe API", "AWS S3" |
| Company / org | Organization | Creator or maintainer | "Google", "Apache Foundation" |
| Software product | Technology | Shipped artifact | "Chrome", "VS Code", "Neo4j Desktop" |
| Design pattern | Concept | Reusable solution | "Microservices", "Event sourcing" |
| Architecture | System | Structural design | "Lambda architecture", "CQRS" |
| Algorithm | Process | Computational procedure | "PageRank", "BERT", "Dijkstra's algorithm" |
| Data format | Technology | Structure for information | "JSON", "Protocol Buffers", "GraphQL schema" |
| Vulnerability / threat | Event | Security issue | "Log4Shell", "Heartbleed" |
| Metric / benchmark | Metric | Performance measurement | "Latency (p99)", "Throughput (req/s)" |
| License | Law | Legal framework | "MIT License", "GPL v3" |
| Infrastructure | System | Deployment platform | "Kubernetes cluster", "AWS Lambda" |
| Development process | Process | Engineering methodology | "CI/CD pipeline", "TDD" |

### Entities to Always Look For

- **Interface boundaries** — APIs, protocols, message formats. These are where systems connect and where failures happen.
- **Bottlenecks and constraints** — What limits performance? What's the single point of failure?
- **Trade-offs** — Technology is all about trade-offs. Consistency vs availability. Speed vs correctness. Extract both sides.
- **Migration paths** — What replaced what? What's being deprecated? What's the upgrade path?

### Entities to Be Cautious About

- **Don't extract every library in a dependency tree** — only those with architectural significance
- **Don't extract configuration values as entities** — "port 8080" is config, not an entity
- **Don't extract code snippets as entities** — extract what the code DOES, not the code itself

---

## 3. Relationship Patterns

### High-Frequency Patterns

| Pattern | relType | causalClassification | Example |
|---------|---------|---------------------|---------|
| A depends on B | DEPENDS_ON | DEPENDS_ON | React --DEPENDS_ON--> JavaScript |
| A implements B | IMPLEMENTS | IMPLEMENTS | Neo4j --IMPLEMENTS--> Property Graph Model |
| A replaces B | REPLACES | TRANSFORMS | React Hooks --REPLACES--> Class Components |
| A enables B | ENABLES | ENABLES | WebSocket --ENABLES--> Real-time Updates |
| A competes with B | COMPETES_WITH | COMPETES_WITH | PostgreSQL --COMPETES_WITH--> MySQL |
| A produces B | GENERATES | PRODUCES | Compiler --GENERATES--> Machine Code |
| A consumes B | CONSUMES | CONSUMES | Docker --CONSUMES--> System Resources |
| A extends B | EXTENDS | SUPPORTS | Plugin --EXTENDS--> VS Code |
| A constrains B | CONSTRAINS | REGULATES | Type System --CONSTRAINS--> Runtime Errors |
| A exposes B | EXPOSES | PRODUCES | API Gateway --EXPOSES--> Microservices |

### Domain Verbs to Causal Families

| Tech Verb | Maps To | Example |
|----------|---------|---------|
| depends on, requires, imports | DEPENDS_ON | Library requires runtime |
| implements, realizes, executes | IMPLEMENTS | Code implements algorithm |
| replaces, deprecates, supersedes | TRANSFORMS | New version replaces old |
| enables, powers, supports | ENABLES | Framework enables development |
| competes with, alternatives | COMPETES_WITH | Technologies in same space |
| produces, generates, emits | PRODUCES | Process produces output |
| consumes, reads, ingests | CONSUMES | Service consumes API |
| blocks, prevents, mitigates | BLOCKS | Security measure blocks attack |
| precedes, leads to, evolves into | PRECEDES | Technology evolution |

---

## 4. Quality Expectations

### Definitions in Technology

- **For technologies:** What it does, how it works (mechanism), what problem it solves, key trade-offs
- **For patterns:** When to use it, what problem it addresses, what alternatives exist
- **For systems:** Components, data flow, scaling characteristics, failure modes
- **For algorithms:** Input, output, complexity, when to use vs alternatives
- **For vulnerabilities:** What it exploits, affected systems, severity, mitigation

### Roles in Technology

- For technologies: what role they play in the specific system being described, why they were chosen over alternatives
- For patterns: how they're applied in this specific context, what trade-offs were accepted
- For companies: what they control, what leverage they have (ecosystem, standards, market share)

### Evidence in Technology

- Include performance numbers when available: "p99 latency under 50ms", "handles 10K req/s"
- Include version numbers for specific claims: "introduced in React 16.8", "deprecated in Python 3.12"
- Architecture decisions need justification quotes, not just outcomes

---

## 5. Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|-------------|
| Extracting implementation details as entities | Code-level specifics aren't graph-worthy | Extract the CONCEPT, not the implementation |
| Missing the "why" behind tech choices | Text describes WHAT was built, you miss WHY | Ask: "What trade-off does this represent?" |
| Confusing product with category | "MongoDB" is a product, "document database" is a category | Extract the product, categorize correctly |
| Over-extracting dependencies | Every import isn't an entity | Only architecturally significant dependencies |
| Missing human factors | Technology is chosen by people in organizations | Extract the organizational context when discussed |

---

## 6. Tag Vocabulary

### Thematic Tags
```
distributed-systems, database, frontend, backend, devops,
machine-learning, security, networking, cloud-computing,
microservices, api-design, data-pipeline, observability,
performance, scalability, reliability
```

### Functional Tags
```
runtime, framework, library, protocol, standard,
orchestrator, message-broker, cache, load-balancer,
gateway, compiler, package-manager
```

### Temporal Tags
```
web-1.0, web-2.0, cloud-era, container-era,
ai-era, serverless-era, mobile-first
```
