const foobarbaz = #{ foo: #{ bar: "baz" } };
let copy = foobarbaz;
copy.foo.bar = "qux";
