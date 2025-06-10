# Protocol Compression Strategy (PCS) Protocol

By default, generate compressed versions of documents in `compressed` folder using filename scheme `pcs_[filename].L[compression level].md`.

If existing versions of compressed documents exist, they should be moved to `.archive/[timestamp]/` folder (batch files together by 'archived' timestamp).

## 📋 TABLE OF CONTENTS
- [Agent Behavior](#agent-behavior)
- [Compression Levels](#compression-levels)
- [Execution Protocol](#execution-protocol)
- [Preservation Requirements](#preservation-requirements)
- [Transformation Techniques](#transformation-techniques)
- [Documentation Requirements](#documentation-requirements)

## AGENT BEHAVIOR

Agent MUST employ PCS when transforming protocol documentation into optimized formats.

## COMPRESSION LEVELS

**Select based on:**
- **L1 (Implementation Guide)**: Comprehensive implementation guidance
- **L2 (Operational Reference)**: Runtime reference and quick checks
- **L3 (Essential Protocol)**: Minimal viable implementation

**Selection criteria:**
- Target use case appropriateness
- Context window constraints
- Information preservation needs

**Document hierarchy:**
- L0 (Source of Truth) = authoritative reference
- All compressed versions must reference Source of Truth
- Implement proper versioning

## EXECUTION PROTOCOL

### 📊 Analysis
1. **Document Mapping**: Inventory components, identify relationships
2. **Baseline Metrics**: Measure tokens, identify inefficiencies
3. **Dependency Analysis**: Map relationships, preserve dependency chains

### 🔄 Transformation
1. **Structural**: Flatten hierarchy, consolidate sections, convert to bullets
2. **Content**: Reduce examples, condense explanations, standardize terminology
3. **Token**: Eliminate whitespace, use command syntax, implement abbreviations

### ✅ Validation
1. **Requirements**: Verify core requirements preserved, maintain equivalence
2. **Metrics**: Measure reduction, verify preservation thresholds
3. **Ambiguity**: Identify misinterpretations, resolve or document risks

## PRESERVATION REQUIREMENTS

### L1 Requirements
- Core protocol requirements (100%)
- Complete component structure (100%)
- Essential examples (60%+)
- Key best practices (80%+)
- All validation criteria (90%+)
- Complete error handling (90%+)

### L2 Requirements
- Core protocol requirements (100%)
- Complete component structure (100%)
- Critical examples only (20%+)
- Essential validation criteria (80%+)
- Basic error handling (70%+)

### L3 Requirements
- Core protocol requirements (100%)
- Essential component structure (90%+)
- Critical validation criteria (60%+)
- Basic error handling (50%+)

## TRANSFORMATION TECHNIQUES

### 🔧 Structural Transformation
1. **Hierarchical Flattening**: Convert multi-level headers to single level
2. **Bullet Compression**: Convert paragraphs to bullet lists
3. **Visual Indexing**: Use emoji for visual categorization

### 📝 Content Transformation
1. **Example Reduction**: Keep only most essential examples
2. **Explanation Condensing**: Reduce explanations to core concepts

### 🔤 Token Optimization
1. **Command Syntax**: Use imperative form
2. **Abbreviation Strategy**: Use consistent abbreviations

## DOCUMENTATION REQUIREMENTS

**Include in all compressed documents:**
1. Compression metadata (level, source, timestamp, metrics)
2. Navigation aids (TOC for L1/L2, visual indexing, cross-references)
3. Preservation statement (what's preserved, reduction warning)

## COMPLIANCE VERIFICATION

1. **Requirement Checklist**: Verify all MUST requirements satisfied
2. **Metric Validation**: Confirm token reduction and information preservation
3. **Functional Testing**: Test implementation using compressed document only

## EXTENSION REQUIREMENTS

When extending PCS:
1. Maintain core principles (fidelity, hierarchy, optimization)
2. Document extensions (identify, provide rationale, document impact)
3. Validate approaches (test effectiveness, compare results)