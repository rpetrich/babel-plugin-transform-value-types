babel-plugin-transform-value-types
==================================

Babel plugin to transform assignment through value types into appropriate copy operations

[![Build Status](https://travis-ci.org/rpetrich/babel-plugin-transform-value-types.svg?branch=master)](https://travis-ci.org/rpetrich/babel-plugin-transform-value-types)

### Input:

```javascript
const foobar = _becomeValue({ foo: "bar" });
let foobaz = foobar;
foobaz.foo = "baz";
```

### Output:

```javascript
const foobar = _becomeValue({ foo: "bar" });
let foobaz = foobar;
foobaz = _assignProperty(foobaz, "foo", "baz");
```
