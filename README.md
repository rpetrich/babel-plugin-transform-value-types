babel-plugin-transform-value-types
==================================

Babel plugin to transform assignment through value types into appropriate copy operations

[![Build Status](https://travis-ci.org/rpetrich/babel-plugin-transform-value-types.svg?branch=master)](https://travis-ci.org/rpetrich/babel-plugin-transform-value-types)

### Input:

```javascript
const foobar = #{ foo: "bar" };
let foobaz = foobar;
foobaz.foo = "baz";
console.log(foobar === #{ foo: "bar" });
```

### Output:

```javascript
const foobar = _becomeValue({ foo: "bar" });
let foobaz = foobar;
foobaz = _assignProperty(foobaz, "foo", "baz");
console.log(_valueStrictEquals(foobar, _becomeValue({ foo: "bar" })));
```

Currently the TypeScript types don't match up during compilation, so ignore any errors during `npm run prepare` :)
