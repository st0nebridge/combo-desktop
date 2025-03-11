# LLM Coding Guidelines: WET / AHA Principles

## 1. **Favor Clarity Over Abstraction**
- Write **explicit, self-contained functions** rather than generic utilities.
- Avoid premature abstraction unless patterns **emerge naturally**.

## 2. **Write Code Twice Before Refactoring**
- Do not extract helper functions until logic appears **at least twice**.
- Only refactor if reuse **improves maintainability** without forcing complexity.

## 3. **Allow Context-Specific Duplication**
- If similar code serves **different business logic**, keep it separate.
- Do not merge logic unless it has **identical behavior in multiple places**.

## 4. **Use Composition Over Inheritance**
- Prefer **small, modular functions** over deep class hierarchies.
- Avoid inheritance unless there is a **clear, stable hierarchy**.

## 5. **Delay Generalization Until Necessary**
- Ask before refactoring:
    - "Will this abstraction make future changes harder?"
    - "Are these similar functions likely to evolve differently?"
- Do not introduce **flexible parameters or configs** just to force reuse.

## 6. **Optimize for Maintainability**
- Prefer **explicit code over concise but unclear logic**.
- Do not introduce **generic, overly dynamic solutions** prematurely.

## 7. **Evolutionary Abstraction**
- Start with **isolated implementations**.
- If patterns emerge across multiple uses, **then extract common logic**.
- Keep abstractions **small and focused**.

> **Rule of Thumb**: **Duplication is cheaper than the wrong abstraction.**
