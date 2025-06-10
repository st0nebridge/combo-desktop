<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\code_documentation.md\pcs_code_documentation.L2.md -->
# PCS L2: Code Documentation Standards

**📊 Compression Metadata:**
- Level: L2 (Operational Reference)
- Source: `../code_documentation.md`
- Timestamp: 2025-06-10
- Token Reduction: ~65%
- Preservation: Core requirements (100%), structure (100%), critical examples (30%)

**🔗 Navigation:** [Source](../code_documentation.md)

## 📝 JSDOC REQUIREMENTS

### 📁 Modules (in `modules/` folders)
```javascript
/**
 * @module ModuleName
 * @description Brief description of what the module does.
 */
```
- **Position:** Very top of file
- **Purpose:** Human + AI consistency maintenance

### 📄 Non-Module JS Files
```javascript
/**
 * @file Description of the file.
 */
```

### 🔧 Functions
```javascript
/**
 * Brief description of what the function does.
 * @function FunctionName
 * @param {Type} paramName - Description of the parameter.
 * @returns {ReturnType} Description of the return value.
 */
```

### 🏗️ Classes
```javascript
/**
 * Brief description of the class.
 * @class ClassName
 * @extends {ParentClass}  // If extending
 * @abstract               // If abstract
 */
class ClassName {
  /**
   * Creates an instance of ClassName.
   * @constructor
   * @param {Type} paramName - Description of the parameter.
   */
  constructor(paramName) {}

  /**
   * Method description.
   * @method methodName
   * @param {Type} param - Parameter description.
   * @returns {Type} Return description.
   */
  methodName(param) {}
}
```

### 🔒 Properties & Methods
```javascript
/**
 * Property description.
 * @type {Type}
 * @private    // If private
 * @static     // If static
 * @readonly   // If readonly
 */

/**
 * Method description.
 * @method methodName
 * @param {Type} param - Description.
 * @returns {Type} Description.
 * @throws {ErrorType} Error conditions.
 * @async      // If async
 * @static     // If static
 * @private    // If private
 * @abstract   // If abstract
 */
```

## 📋 DOCUMENTATION STANDARDS
- ✅ All public methods documented
- ✅ All classes documented
- ✅ Module headers at file top
- ✅ Parameter types and descriptions
- ✅ Return value descriptions
- ✅ Error conditions documented
- ✅ Async/static/private annotations

**⚠️ Preservation Statement:**
All JSDoc formatting requirements and standards preserved. Extended examples condensed to essential patterns.
