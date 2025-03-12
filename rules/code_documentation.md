# DOCUMENTATION RULES

## Javascript

JavaScript files should use JSDoc format.

### Modules (LIKELY within a `modules` folder)
- All modules should have a JSDoc at the top in the following format:
```
/**
 * @module ModuleName
 * @description Brief description of what the module does.
 */
```
- Module top-comment should be useful to both humans, and AI to maintain consistency
- Module top-comment MUST be placed at very top of file


### JS Files (non-Module)
- All non-modules js files should have a JSDoc at the top in the following format:
```
/**
 * @file Description of the file.
 */
```

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
 * @extends {ParentClass} If extending another class
 * @abstract If class is abstract
 */
class ClassName {
  /**
   * Creates an instance of ClassName.
   * @constructor
   * @param {Type} paramName - Description of the parameter.
   * @throws {Error} If abstract class is instantiated directly
   */
  constructor(paramName) {
    this.paramName = paramName;
  }

  /**
   * Brief description of the method.
   * @method methodName
   * @abstract If method must be implemented by child classes
   * @param {Type} paramName - Description of the parameter.
   * @returns {ReturnType} Description of the return value.
   * @throws {Error} If abstract method not implemented
   */
  methodName(paramName) {
    return paramName;
  }
}

### Abstract Classes
- Must include `@abstract` tag in class JSDoc
- Must document all required implementations at the top of file:
```
/**
 * @file Abstract base class description
 * 
 * Required implementations by child classes:
 * - methodA(): Description of what the method should do
 * - methodB(): Description of what the method should do
 */
```
- Abstract methods must:
  - Include `@abstract` tag
  - Document expected behavior
  - Document parameters and return types
  - Throw error if not implemented
- Constructor must prevent direct instantiation

### Inherited Classes
- Must include `@extends` tag with parent class name
- Must document any new functionality added
- Must document any overridden methods
- Must maintain parameter/return type compatibility with parent

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
