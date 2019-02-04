import { AssignmentExpression, ArrowFunctionExpression, AwaitExpression, BlockStatement, CallExpression, LabeledStatement, Node, Expression, FunctionDeclaration, Statement, Identifier, ForStatement, ForInStatement, SpreadElement, ReturnStatement, ForOfStatement, Function, FunctionExpression, MemberExpression, NumericLiteral, ThisExpression, SwitchCase, Program, VariableDeclaration, VariableDeclarator, StringLiteral, BooleanLiteral, Pattern, LVal, YieldExpression } from "@babel/types";
import { NodePath, Scope, Visitor } from "@babel/traverse";

interface PluginState {
	opts: {};
}

// Main function, called by babel with module implementations for types, template, traverse, transformFromAST and its version information
export default function({ types }: { types: typeof import("@babel/types") }) {

	function createTemporary(path: NodePath, expression: Expression): { temporary: Identifier, assignment: AssignmentExpression } {
		const temporary = path.scope.generateUidIdentifierBasedOnNode(expression);
		path.scope.push({ kind: "let", id: temporary });
		return { temporary, assignment: types.assignmentExpression("=", temporary, expression) };
	}

	function isAValue(path: NodePath<Expression>): boolean | undefined {
		if (path.isIdentifier()) {
			const binding = path.scope.getBinding(path.node.name);
			if (binding && binding.constant) {
				const bindingPath = binding.path;
				if (bindingPath.isVariableDeclarator()) {
					const init = bindingPath.get("init");
					if (init && init.node !== null) {
						return isAValue(init as NodePath<Expression>);
					} else {
						return false;
					}
				}
			}
			return undefined;
		}
		if (path.isConditionalExpression()) {
			const consequent = isAValue(path.get("consequent"));
			const alternate = isAValue(path.get("alternate"));
			return consequent === alternate ? consequent : undefined;
		}
		if (path.isLogicalExpression()) {
			const left = isAValue(path.get("left"));
			const right = isAValue(path.get("right"));
			return right === left ? left : undefined;
		}
		if (path.isParenthesizedExpression()) {
			return isAValue(path.get("expression"));
		}
		if (path.isUnaryExpression()) {
			return path.node.operator === "#";
		}
		if (path.isLiteral() || path.isObjectExpression() || path.isArrayExpression() || path.isBinaryExpression() || path.isArrowFunctionExpression() || path.isFunctionExpression() || path.isClassExpression() || path.isTaggedTemplateExpression() || path.isBindExpression()) {
			return false;
		}
		return undefined;
	}

	return {
		manipulateOptions(options: any, parserOptions: { plugins: string[] }) {
			parserOptions.plugins.push("valueTypeOperator");
		},
		visitor: {
			AssignmentExpression(path) {
				const node = path.node;
				const left = path.get("left");
				if (left.isMemberExpression() && isAValue(left) === undefined) {
					const object = left.get("object");
					if (object.isLVal()) {
						if (object.isIdentifier()) {
							const binding = path.scope.getBinding(object.node.name);
							if (binding && binding.kind === "const") {
								if (isAValue(object) === true) {
									throw object.buildCodeFrameError(`Assignment to a value object that is constant`, TypeError);
								}
								return;
							}
						}
						let assignmentTarget = object.node;
						let readTarget = object.node;
						if (object.isMemberExpression()) {
							let rewriteObject;
							if (!object.get("object").isPure()) {
								rewriteObject = createTemporary(path, object.get("object").node);
							}
							let rewriteProperty;
							if (object.node.computed && !object.get("property").isPure()) {
								rewriteProperty = createTemporary(path, object.get("property").node);
							}
							if (rewriteObject || rewriteProperty) {
								assignmentTarget = types.memberExpression(
									rewriteObject ? rewriteObject.assignment : object.node.object,
									rewriteProperty ? rewriteProperty.assignment : object.node.property,
									object.node.computed
								);
								readTarget = types.memberExpression(
									rewriteObject ? rewriteObject.temporary : object.node.object,
									rewriteProperty ? rewriteProperty.temporary : object.node.property,
									object.node.computed
								);
							}
						}
						let rightNode = node.right;
						let temporaryNode;
						if (!path.parentPath.isExpressionStatement()) {
							const { temporary, assignment } = createTemporary(path, rightNode);
							rightNode = assignment;
							temporaryNode = temporary;
						}
						if (node.operator !== "=") {
							rightNode = types.binaryExpression(node.operator.substr(0, node.operator.length - 1) as any, types.memberExpression(readTarget, left.node.property, left.node.computed), rightNode);
						}
						const replacement = types.assignmentExpression(
							"=",
							assignmentTarget,
							types.callExpression(types.identifier("_assignProperty"), [
								readTarget,
								left.node.computed ? left.node.property : types.stringLiteral((left.node.property as Identifier).name),
								rightNode
							])
						);
						path.replaceWith(temporaryNode !== undefined ? types.sequenceExpression([replacement, temporaryNode]) : replacement);
						path.skip();
					}
				}
			},
			BinaryExpression(path) {
				let compareStrictly;
				let notEqual;
				switch (path.node.operator) {
					case "==":
						compareStrictly = false;
						notEqual = false;
						break;
					case "===":
						compareStrictly = true;
						notEqual = false;
						break;
					case "!=":
						compareStrictly = false;
						notEqual = true;
						break;
					case "!==":
						compareStrictly = true;
						notEqual = true;
						break;
					default:
						return;
				}
				if (isAValue(path.get("left")) === false || isAValue(path.get("right")) === false) {
					return;
				}
				const replacement = types.callExpression(types.identifier(compareStrictly ? "_valueStrictEquals" : "_valueEquals"), [path.node.left, path.node.right]);
				path.replaceWith(notEqual ? types.unaryExpression("!", replacement) : replacement);
			},
			UnaryExpression(path) {
				if (path.node.operator as any === "#") {
					path.replaceWith(types.callExpression(types.identifier("_becomeValue"), [path.node.argument]));
				}
			},
		} as Visitor<PluginState>
	}
}

module.exports = exports.default;
