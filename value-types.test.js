const pluginUnderTest = require(".");
const babel7 = require("@babel/core");
const types7 = require("@babel/types");
const fs = require("fs");
const util = require("util");

const checkTestCases = true;
const checkOutputMatches = true;
const testsToRun = [];
const shouldWriteOutput = true;

const environments = [
	["babel 7", babel7, types7, pluginUnderTest(babel7)],
];

const helperNames = ["_isValueSymbol", "_valueEquals", "_valueStrictEquals", "_becomeValue", "_assignProperty"];

const stripHelpersVisitor = {
	FunctionDeclaration(path) {
		// Remove function declaration of a helper
		if (helperNames.indexOf(path.node.id.name) === -1) {
			path.skip();
		} else {
			path.remove();
		}
	},
	VariableDeclarator(path) {
		// Remove variable declarator of a helper
		if (helperNames.indexOf(path.node.id.name) === -1) {
			path.skip();
		} else if (path.isFunction() && path.id) {
			path.skip();
		} else if (path.isVariableDeclaration()) {
			const allDeclarations = path.get("declarations");
			const declarationsToRemove = allDeclarations.filter(declaration => /^_async/.test(declaration.node.id.name));
			if (declarationsToRemove.length === allDeclarations.length) {
				path.remove();
			} else {
				for (const declaration of allDeclarations) {
					declaration.remove();
				}
				path.skip();
			}
		} else if (!path.node.ignored) {
			path.remove();
		}
	},
	AssignmentExpression(path) {
		// Remove assignment to a helper
		if (path.parentPath.isExpressionStatement()) {
			let left = path.get("left");
			while (left.isMemberExpression()) {
				left = left.get("object");
			}
			if (left.isIdentifier() && helperNames.indexOf(left.node.name) !== -1) {
				path.parentPath.remove();
			}
		}
	}
};

function extractOnlyUserCode(babel, result) {
	return babel.transformFromAst(result.ast, result.code, { plugins: [{ visitor: stripHelpersVisitor }], compact: true, ast: false }).code;
}

function extractJustFunction(babel, result) {
	const extracted = extractOnlyUserCode(babel, result);
	const match = extracted.match(/(^return\s*)?([\s\S]*);\s*$/);
	return match ? match[2] : extracted;
}

function writeOutput(name, myCode, outputCode) {
	if (shouldWriteOutput) {
		if (fs.existsSync(name)) {
			fs.unlinkSync(name);
		}
		if (typeof outputCode === "undefined" || myCode !== outputCode) {
			fs.writeFileSync(name, myCode);
		} else {
			fs.symlinkSync("output.js", name);
		}
	}
}

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

function readTest(name) {
	let input;
	let output;
	let options;
	const cases = Object.create(null);
	for (const fileName of fs.readdirSync(`tests/${name}`)) {
		const content = fs.readFileSync(`tests/${name}/${fileName}`).toString();
		if (fileName === "input.js") {
			input = content;
		} else if (fileName === "output.js") {
			output = content;
		} else if (fileName === "options.json") {
			options = JSON.parse(content);
		} else {
			const caseMatch = fileName.match(/^case-(.*)\.js$/);
			if (caseMatch !== null) {
				cases[caseMatch[1]] = new AsyncFunction("f", content);
			}
		}
	}
	const { error, checkSyntax = true, module = true } = options || {};
	return {
		error,
		checkSyntax,
		module,
		input,
		output,
		cases,
	};
}

function parse(babel, input) {
	return babel.parse(input, { parserOpts: { allowReturnOutsideFunction: true, plugins: ["valueTypeOperator"] }, sourceType: "module" });
}

for (const [babelName, babel] of environments) {
	parse(babel, "let test;");
}

for (const name of fs.readdirSync("tests").sort()) {
	if (testsToRun.length && testsToRun.indexOf(name) === -1) {
		continue;
	}
	if (fs.statSync(`tests/${name}`).isDirectory()) {
		describe(name, () => {
			const { input, output, cases, error, checkSyntax, module } = readTest(name);
			for (const [babelName, babel, types, pluginUnderTest] of environments) {
				describe(babelName, () => {
					const parseInput = module ? input : "return " + input;
					const ast = parse(babel, parseInput);
					if (error) {
						test("error", () => {
							try {
								babel.transformFromAst(ast, parseInput, { plugins: [[pluginUnderTest, {}]], compact: true })
								throw new Error("Expected error: " + error.toString());
							} catch (e) {
								expect(e.toString()).toEqual(expect.stringContaining(error));
							}
						});
						return;
					}
					const extractFunction = module ? extractOnlyUserCode : extractJustFunction;
					const result = babel.transformFromAst(types.cloneDeep(ast), parseInput, { plugins: [[pluginUnderTest, { target: "es6" }]], compact: true, ast: true });
					const strippedResult = extractFunction(babel, result);
					writeOutput(`tests/${name}/output.js`, strippedResult);
					let fn, rewrittenFn;
					try {
						fn = new Function(`/* ${name} original */${parseInput}`)
					} catch (e) {
					}
					if (checkSyntax) {
						test("syntax", () => {
							const code = result.code;
							try {
								rewrittenFn = new Function(`/* ${name} */${code}`);
							} catch (e) {
								if (e instanceof SyntaxError) {
									e.message += "\n" + code;
								}
								throw e;
							}
						});
					}
					if (checkOutputMatches) {
						if (typeof output !== "undefined") {
							test("output", () => {
								expect(strippedResult).toBe(output);
							});
						}
					}
					if (checkTestCases) {
						for (let key of Object.getOwnPropertyNames(cases)) {
							test(key, () => {
								if (rewrittenFn) {
									return cases[key](rewrittenFn());
								}
							});
						}
					}
				});
			}
		});
	}
}
