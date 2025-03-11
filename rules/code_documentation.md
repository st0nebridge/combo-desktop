# DOCUMENTATION RULES

## Javascript

JavaScript files should use JSDoc format.

### Modules
- All modules should have a JSDoc at the top in the following format:
```
/**
 * @module ModuleName
 * @description Brief description of what the module does.
 */
```
- Module top-comment should be useful to both humans, and AI to maintain consistency

### Functions
- All functions should include a JSDoc comment with the following format:
```
/**
 * Brief description of what the function does.
 * @function FunctionName
 * @param {Type} paramName - Description of the parameter.
 * @returns {ReturnType} Description of the return value.
 */
```

### Classes
- All classes should include a JSDoc comment with the following format:
```
/**
 * Brief description of the class.
 * @class ClassName
 */
class ClassName {
  /**
   * Creates an instance of ClassName.
   * @constructor
   * @param {Type} paramName - Description of the parameter.
   */
  constructor(paramName) {
    this.paramName = paramName;
  }

  /**
   * Brief description of the method.
   * @method methodName
   * @param {Type} paramName - Description of the parameter.
   * @returns {ReturnType} Description of the return value.
   */
  methodName(paramName) {
    return paramName;
  }
}
```

### Constants
- All constants should include a JSDoc comment with the following format:
```
/**
 * Brief description of the constant.
 * @constant {Type} CONSTANT_NAME
 */
const CONSTANT_NAME = value;
```

### Properties
- Class properties should include a JSDoc comment with the following format:
```
/**
 * Brief description of the property.
 * @property {Type} propertyName
 */
this.propertyName = value;
```

### Typedefs
- Custom types should be defined using @typedef in the following format:
```
/**
 * Description of the custom type.
 * @typedef {Object} TypeName
 * @property {Type} propertyName - Description of the property.
 */
```
