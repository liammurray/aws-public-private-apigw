"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const util_1 = require("../../src/util");
function addFlattenTest(str) {
    const arr = str.split('/').map(item => item.split(''));
    const expected = str.replace(/\//g, '').split('');
    it(`flatten: ${JSON.stringify(arr)} => ${JSON.stringify(expected)}`, function () {
        const flat = util_1.flatten(arr);
        chai_1.expect(flat).to.be.an('array');
        chai_1.expect(flat).to.have.ordered.members(expected);
    });
}
describe('Flatten', function () {
    const tests = ['a', 'a/bc', 'ab/cd/ef', 'ab//c/d/e'];
    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(addFlattenTest);
});
//# sourceMappingURL=util.test.js.map