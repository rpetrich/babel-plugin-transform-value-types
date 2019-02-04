export const _isValueSymbol = Symbol.for("isValueSymbol");

if (typeof Object.prototype[isValueSymbol] !== "boolean") {
	Object.defineProperty(Object.prototype, isValueSymbol, {
		value: false,
	});
	const oldIs = Object.is;
	Object.is = function(left, right) {
		const result = oldIs.call(this, left, right);
		if (result) {
			return true;
		}
		if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
			return false;
		}
		const leftKeys = Object.keys(left);
		const rightKeys = Object.keys(right);
		if (leftKeys.length !== rightKeys.length) {
			return false;
		}
		for (let i = 0; i < leftKeys.length; i++) {
			const key = leftKeys[i];
			if (key !== rightKeys[i] || !Object.is(left[key], right[key])) {
				return false;
			}
		}
		return true;
	}
	Array.prototype.indexOf = function(searchElement, fromIndex = 0) {
		for (let i = fromIndex; i < this.length; i++) {
			if (_valueStrictEquals(this[i], searchElement)) {
				return i;
			}
		}
		return -1;
	}
	Array.prototype.lastIndexOf = function(searchElement, fromIndex = this.length - 1) {
		for (let i = fromIndex; i >= 0; i--) {
			if (_valueStrictEquals(this[i], searchElement)) {
				return i;
			}
		}
		return -1;
	}
	Array.prototype.includes = function(searchElement, fromIndex = 0) {
		for (let i = fromIndex; i < this.length; i++) {
			if (_valueStrictEquals(this[i], searchElement)) {
				return true;
			}
		}
		return false;
	}
}

export function _valueEquals(left, right) {
	if (typeof left !== "object" || !left[isValueSymbol] || typeof right !== "object" || !right[isValueSymbol]) {
		return left == right;
	}
	if (left === right) {
		return true;
	}
	if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}
	for (let i = 0; i < leftKeys.length; i++) {
		const key = leftKeys[i];
		if (key !== rightKeys[i] || !valueEquals(left[key], right[key])) {
			return false;
		}
	}
	return true;
}

export function _valueStrictEquals(left, right) {
	if (typeof left !== "object" || !left[isValueSymbol] || typeof right !== "object" || !right[isValueSymbol]) {
		return left === right;
	}
	if (left === right) {
		return true;
	}
	if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}
	for (let i = 0; i < leftKeys.length; i++) {
		const key = leftKeys[i];
		if (key !== rightKeys[i] || !valueStrictEquals(left[key], right[key])) {
			return false;
		}
	}
	return true;
}

export function _becomeValue(object) {
	if (typeof object !== "object") {
		return object;
	}
	Object.defineProperty(object, isValueSymbol, {
		value: true,
	});
	return Object.freeze(object);
}

export function _assignProperty(object, key, newValue) {
	if (!object[isValueSymbol]) {
		object[key] = newValue;
		return object;
	}
	if (_valueStrictEquals(object[key], newValue)) {
		return object;
	}
	const result = Object.assign(Object.create(Object.getPrototypeOf(object)), object);
	result[key] = newValue;
	Object.defineProperty(result, isValueSymbol, {
		value: true,
	});
	return Object.freeze(result);
}
