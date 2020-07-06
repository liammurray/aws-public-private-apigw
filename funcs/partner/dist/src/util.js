"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swap = exports.flatten = void 0;
function flatten(arr) {
    return arr.reduce((prev, cur) => prev.concat(cur));
}
exports.flatten = flatten;
// tslint:disable-next-line function-name
function swap(arr, first, second) {
    const temp = arr[first];
    arr[first] = arr[second]; // eslint-disable-line no-param-reassign
    arr[second] = temp; // eslint-disable-line no-param-reassign
    return arr;
}
exports.swap = swap;
//# sourceMappingURL=util.js.map