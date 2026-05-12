Title: Gene Mutation Pathogenomics Research Map

Description: Graph-ready research brief derived from the paper "Multi-Label Gene Mutation Classification from Histopathology Images via Deep Feature Extraction and Classical Machine Learning" and its 20 cited works.

Source: C:\Users\Vivek\Downloads\project_1__Copy___Copy_.pdf

Note on scope:
This project is grounded in the full text of the provided paper and in the summaries, claims, and reference metadata that the paper itself provides about 20 related works. The cited papers were not provided as separate PDFs in this repo, so this graph-ready brief maps them through the evidence available inside the supplied paper rather than pretending to have extracted every full text independently.

## Research Focus

This research domain asks whether somatic gene mutation status can be inferred from routine histopathology images instead of depending only on next-generation sequencing. The central practical driver is precision oncology: mutation profiles determine eligibility for targeted therapies, yet sequencing remains expensive, slow, and unevenly accessible across hospitals and regions.

The anchor paper reframes the problem around data granularity. Instead of aggregating each patient into one feature vector, it treats each image patch as an independent labelled sample. That design change expands the effective training set from patient count scale to image count scale and becomes the main mechanism that makes classical machine learning viable in a very small cohort.

## Anchor Paper

Paper:
Multi-Label Gene Mutation Classification from Histopathology Images via Deep Feature Extraction and Classical Machine Learning

Core claim:
Image-level training plus explicit imbalance correction can turn a small-cohort mutation-classification problem from statistically weak to practically usable.

Study setting:
- 12 TCGA lung cancer patients covering LUAD and LUSC
- 4,062 histopathology image patches
- 3,087 original gene labels
- 2,982 non-constant genes retained for training
- 2,843 train patches and 1,219 test patches from a 70/30 image-level split

Pipeline:
1. Whole-slide image tiling and tissue detection.
2. Frozen ResNet-50 feature extraction using 2,048-dimensional GAP vectors.
3. Binary relevance multi-label modelling using MultiOutputClassifier with XGBoost.
4. Global imbalance correction through `scale_pos_weight = 9.77`.
5. Evaluation at overall, per-image, per-patient, and per-gene levels.

Reported performance:
- Hamming loss: 0.0146
- Exact match accuracy: 67.51%
- Micro-F1: 0.9175
- Micro-precision: 0.9441
- Micro-recall: 0.8924
- Average per-image recall: 90.60%
- Average per-image precision: 93.65%
- Per-patient recall range: 49.77% to 97.87%

## Core Domain Concepts

### Biological and clinical layer
- Somatic gene mutation
- Molecular fingerprint of tumour
- Precision oncology
- Actionable mutations
- Mutation-driven therapy selection
- Genotype-phenotype correlation
- Morphological footprint hypothesis

### Data and modality layer
- Histopathology images
- Whole-slide images
- Tissue-rich patch extraction
- Gene mutation labels
- TCGA
- PathGene benchmark
- DeepGEM multicentre cohort

### Modelling layer
- Image-level training
- Patient-level aggregation
- Tile-label inheritance
- Deep feature extraction
- ResNet-50
- XGBoost
- MultiOutputClassifier
- Binary relevance
- Class imbalance correction
- Attention-based multiple instance learning
- Multimodal fusion
- Co-mutation modelling

### Performance and validation layer
- Micro-F1
- Recall-focused pre-screening
- External validation
- Leave-one-patient-out validation
- Cross-institutional generalization
- Interpretability
- Deployment readiness

## Knowledge Graph Narrative

### Main causal chain
Limited sequencing access creates demand for image-based mutation inference. Histopathology slides already exist in routine workflows. Deep or classical models can search for morphological patterns linked to genomic events. The main paper argues that small-cohort failure is often caused less by model family and more by patient-level aggregation that destroys training density. Preserving tile-level instances restores statistical support for mutation learning. Class weighting then shifts the model toward clinically useful sensitivity.

### Key graph assertions
1. Histopathology images are proposed as a lower-cost and faster screening path that complements rather than fully replaces sequencing.
2. Morphology is treated as an observable phenotype of latent genomic alterations.
3. Patient-level averaging is identified as a bottleneck because it collapses heterogeneous tumour morphology into one vector.
4. Image-level training is positioned as the anchor methodological innovation of the paper.
5. Class imbalance correction is treated as a clinical design decision, not just a tuning trick.
6. Current evaluation is strong at held-out tile level but weaker for patient-level generalization because all patients appear in train and test.
7. Future progress is expected to come from multimodal fusion, MIL, larger cohorts, and validation on benchmark datasets.

## Related Work Map

### Group A: Histopathology-only mutation prediction

[20] Coudray et al. (2018)
- Early landmark in mutation prediction from non-small cell lung cancer histopathology.
- Used Inception-V3 on TCGA NSCLC slides.
- Established that mutations such as EGFR, STK11, and KRAS can leave computable morphological signatures.
- Graph role: foundational proof that genotype-phenotype links are visible in pathology images.

[7] Wang et al. (2021)
- Predicted BRCA mutation in breast cancer from histopathology images.
- Used ResNet-based CNNs over multiple magnifications.
- Showed sensitivity to cohort size and image scale.
- Graph role: evidence that mutation prediction generalizes beyond lung tissue.

[18] Nakagaki et al. (2024)
- Predicted IDH1 mutation in glioma with attention-based MIL plus LightGBM and clinical features.
- Graph role: bridge between histology-only pipelines and multimodal or MIL-based approaches.

[8] Zhao et al. / DeepGEM Collaboration (2024)
- Large multicentre lung cancer mutation prediction study using annotation-free deep learning and co-supervision.
- Reported strong AUCs and external robustness.
- Graph role: current high-performance frontier and external-validation benchmark.

[19] Chen et al. (2020)
- Predicted liver-cancer mutations from H&E images.
- Graph role: supports cross-cancer generality of the morphological footprint idea.

[4] Pan et al. (2025) PathGene
- Introduced a multicentre benchmark for driver gene mutation and exon prediction in lung cancer histopathology.
- Graph role: dataset infrastructure for robust evaluation, benchmarking, and external validation.

### Group B: Multimodal oncology models

[1] Steyaert et al. (2023)
- Fused histoprognostic signals with gene expression for prognosis prediction in brain tumours.
- Graph role: shows pathway discovery value from multimodal learning.

[2] Berloco et al. (2025)
- Connected pathomics and transcriptomics to mutation classification in pancreatic cancer.
- Graph role: demonstrates interpretable multimodal mutation prediction with strong KRAS performance.

[5] Chen R.J. et al. (2022)
- Pan-cancer multimodal histology-genomics analysis across 14 cancer types.
- Graph role: large-scale evidence that image features correlate with molecular subtypes and outcomes.

[9] He et al. (2025)
- Combined histopathology, clinical data, and mutation information for colorectal survival prediction.
- Graph role: supports the value of fusion over unimodal pipelines.

[17] Yang et al. (2025)
- Review reporting average multimodal gains over unimodal systems in precision oncology.
- Graph role: synthesis node connecting many modality-integration studies.

[14] Krones et al. (2025)
- Broader multimodal AI in medicine review.
- Graph role: problem framing for standardization, interpretability, and deployment readiness.

### Group C: Genomics-centred or adjacent methods

[15] Elsamahy et al. (2024)
- Automated mutation classification directly from structured genetic data.
- Graph role: shows mutation learning from non-image inputs.

[10] Ye et al. (2021)
- Converted mutation data into 2D maps for pan-cancer classification.
- Graph role: alternative representation strategy for genomics.

### Group D: Broader contextual references

[3] Maigari et al. (2025)
- Breast-cancer multimodal deep learning using hybrid models.
- Graph role: supports broader multimodal trend.

[6] Alanazi et al. (2025)
- Multimodal lung-disease detection from MRI.
- Graph role: adjacent multimodal imaging context, not direct mutation prediction.

[11] Bilal et al. (2025)
- Quantum-optimized breast-cancer image classification.
- Graph role: edge exploration of alternative classifier families.

[12] Radhi et al. (2025)
- Review of quantum and deep learning for medical-image classification.
- Graph role: methods frontier rather than direct path-genomics evidence.

[13] Review of multimodal machine learning approaches in healthcare (2025)
- Graph role: broad review node for general multimodal healthcare trends.

[16] Landman et al. (2022)
- Quantum methods for neural networks in medical image classification.
- Graph role: speculative methods branch.

## Research Tensions and Contradictions

### Tension 1: Strong image-level metrics versus weak patient-level generalization
The anchor paper reports strong held-out patch metrics, but the train/test split is image-level rather than patient-level. This means the model has already seen morphological patterns from every patient during training. The graph should therefore separate "tile-level discrimination" from "new-patient generalization" instead of treating them as the same claim.

### Tension 2: Classical ML practicality versus deep-learning performance ceilings
The paper makes a strong case that classical pipelines can be effective when data granularity is corrected. At the same time, DeepGEM and multimodal studies imply that large-cohort deep systems likely define the performance frontier. The graph should encode this as a trade-off between accessibility and ceiling performance.

### Tension 3: Label breadth versus biological dependency
Binary relevance across 2,982 genes scales well, but it ignores co-mutation structure and epistasis. The graph should mark this as an explicit modelling simplification.

### Tension 4: Tile-label inheritance versus spatial truth
Every tile inherits the patient mutation vector, yet not every tile may visibly express each mutation-linked phenotype. This introduces label noise and motivates MIL, spatial graph models, and better localization.

## Failure Modes Important for the Graph

- Small patient cohorts create misleading confidence if evaluation is not patient-held-out.
- Mutation rarity causes models to overpredict wild-type without explicit imbalance handling.
- Dataset benchmark claims are not interchangeable across cancers, modalities, and evaluation protocols.
- Review papers summarize trends but provide weaker direct evidence than disease-specific benchmark studies.
- Quantum and adjacent multimodal papers are methods-neighbor nodes, not central evidence for lung-cancer mutation prediction.

## Future Work Nodes

- Leave-one-patient-out evaluation
- External validation on PathGene
- External validation on larger TCGA subsets
- Attention-based MIL
- Patient-level consensus from image-level predictions
- Co-mutation and classifier-chain modelling
- Spatial graph neural networks over tile neighborhoods
- Multimodal fusion with transcriptomics and clinical metadata
- Interpretable mutation evidence maps

## Researcher Questions This Graph Should Help Answer

1. Which papers directly support the claim that mutation status is visible in histopathology morphology?
2. Which datasets and cohorts are central for lung-cancer mutation prediction benchmarking?
3. Is the biggest gain coming from architecture, data size, or framing the learning unit correctly?
4. Where does the current paper improve over patient-level baselines, and where does it remain limited?
5. Which future directions are most justified by the literature already cited in the paper?

## Suggested Graph Spine

Use the following spine as the first-pass ontology for ingestion:
- Paper
- Method
- Dataset
- CancerType
- Gene
- Metric
- Limitation
- FutureDirection
- ResearchProblem
- ClinicalObjective
- ModelFamily
- EvaluationProtocol

Key edge types:
- INVESTIGATES
- USES_DATASET
- PREDICTS
- USES_METHOD
- OUTPERFORMS
- LIMITS
- VALIDATES_ON
- MOTIVATES
- FUTURE_WORK_FOR
- REVIEWS
- SUPPORTS_CLAIM
- CONTRASTS_WITH

## Bottom-Line Synthesis

The anchor paper’s most valuable contribution is not merely another classifier result. It isolates a structural mistake in small-cohort path-genomics workflows: patient-level aggregation erases the sample density needed for mutation learning. The 20-paper literature context then places this contribution inside a broader field shaped by three forces: morphology-to-genomics inference, multimodal fusion, and the demand for clinically deployable systems that remain useful when large curated cohorts are unavailable.
