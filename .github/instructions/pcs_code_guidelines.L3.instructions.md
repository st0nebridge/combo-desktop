# Essential Coding Guidelines

## 🎯 WET / AHA PRINCIPLES

### 💡 CORE RULES
1. **Clarity > Abstraction** → Explicit, self-contained functions
2. **Write Twice Rule** → No helper functions until 2+ uses
3. **Context-Specific Duplication** → Different business logic = separate code
4. **Composition > Inheritance** → Small modular functions, stable hierarchies only
5. **Delay Generalization** → Wait for natural patterns to emerge
6. **Optimize for Maintainability** → Explicit > concise but unclear
7. **Evolutionary Abstraction** → Isolated → patterns → extract common logic

### ❓ BEFORE REFACTORING ASK
- "Will this abstraction make future changes harder?"
- "Are these similar functions likely to evolve differently?"

### 🚫 AVOID
- ❌ Premature abstraction
- ❌ Generic utilities without clear reuse
- ❌ Flexible parameters/configs just for reuse
- ❌ Deep class hierarchies
- ❌ Generic, overly dynamic solutions

### ✅ PREFER
- ✅ Explicit, self-contained code
- ✅ Small, focused abstractions
- ✅ Natural pattern emergence
- ✅ Clear, stable hierarchies

**💡 Rule of Thumb:** Duplication is cheaper than the wrong abstraction.

**⚠️ Preservation Statement:**
Core WET/AHA principles preserved. Implementation guidelines condensed to essential rules.
