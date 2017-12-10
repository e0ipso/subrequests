// Uncomment these two lines during test development for great debuggability.
// require('flow-remove-types/register');
// const BlueprintManager = require('../../src/BlueprintManager');
const BlueprintManager = require('../../lib/BlueprintManager');

const sinon = require('sinon');

module.exports = {
  fillDefaultsTest: {
    success(test) {
      test.expect(10);
      let filled = BlueprintManager.fillDefaults({
        body: 'true',
        uri: 'http://example.org?query=%7B%7Bfoo%40bar%7D%7D&lorem',
      });
      test.notEqual(typeof filled.requestId, 'undefined');
      test.deepEqual(filled.headers, {});
      test.deepEqual(filled.waitFor, ['<ROOT>']);
      test.equal(filled.body, true);
      test.equal(filled.uri, 'http://example.org?query={{foo@bar}}&lorem');
      filled = BlueprintManager.fillDefaults({
        requestId: 'lorem',
        headers: { ipsum: 'dolor' },
        waitFor: ['sid'],
      });
      test.equal(filled.requestId, 'lorem');
      test.deepEqual(filled.headers, new Map([['ipsum', 'dolor']]));
      test.deepEqual(filled.waitFor, ['sid']);
      test.equal(typeof filled.body, 'undefined');
      test.ok(!filled._resolved);
      test.done();
    },
    fail(test) {
      test.expect(1);
      test.throws(() => {
        BlueprintManager.fillDefaults({ body: 'lorem' });
      }, Error);
      test.done();
    },
  },
  buildExecutionSequenceTest: {
    success(test) {
      test.expect(2);
      const parsed = [
        {
          requestId: '1',
          waitFor: ['<ROOT>'],
        },
        {
          requestId: '2',
          waitFor: ['<ROOT>'],
        },
        {
          requestId: '3',
          waitFor: ['1'],
        },
        {
          requestId: '4',
          waitFor: ['3'],
        },
        {
          requestId: '5',
          waitFor: ['2'],
        },
      ];
      const tree = BlueprintManager.buildExecutionSequence(parsed);
      const expectedTree = [
        [{ requestId: '1', waitFor: ['<ROOT>'] }, { requestId: '2', waitFor: ['<ROOT>'] }],
        [{ requestId: '3', waitFor: ['1'] }, { requestId: '5', waitFor: ['2'] }],
        [{ requestId: '4', waitFor: ['3'] }],
      ];
      test.deepEqual(tree, expectedTree);
      test.throws(() => {
        BlueprintManager.buildExecutionSequence([{
          action: 'view',
          uri: 'http://example.org',
          waitFor: ['fail'],
        }]);
      }, Error);
      test.done();
    },
  },
  isValidTreeTest(test) {
    test.expect(6);
    test.ok(!BlueprintManager.isValidTree([{}]));
    test.ok(!BlueprintManager.isValidTree([{ requestId: '1' }]));
    test.ok(!BlueprintManager.isValidTree([
      {
        requestId: 'lorem',
        waitFor: ['ipsum'],
        uri: 'foo',
        action: 'bar',
        headers: 'moo',
      },
    ]));
    test.ok(!BlueprintManager.isValidTree([
      {
        requestId: 'lorem',
        waitFor: ['ipsum'],
        uri: 'foo',
        action: 'exists',
        headers: { moo: 'bah' },
      },
      { requestId: '1' },
    ]));
    test.ok(BlueprintManager.isValidTree([
      {
        requestId: 'lorem',
        waitFor: ['ipsum'],
        uri: 'foo',
        action: 'exists',
        headers: { moo: 'bah' },
      },
    ]));
    test.ok(BlueprintManager.isValidTree([
      {
        requestId: 'lorem',
        waitFor: ['ipsum'],
        uri: 'foo',
        action: 'exists',
        headers: { moo: 'bah' },
        body: { foo: 'bar' },
      },
    ]));
    test.done();
  },
  parseTest(test) {
    test.expect(5);
    const fillDefaults = sinon.stub(BlueprintManager, 'fillDefaults')
      .callsFake(i => i);
    this.stubs.push(fillDefaults);
    test.throws(() => BlueprintManager.parse('lorem'), Error);
    const userInput = '[{"action":"view","uri":"http://example.org","requestId":"1","waitFor":["<ROOT>"]}]';
    const isValidTree = sinon.stub(BlueprintManager, 'isValidTree')
      .returns(true);
    test.deepEqual(BlueprintManager.parse(userInput), [[{
      action: 'view',
      uri: 'http://example.org',
      requestId: '1',
      waitFor: ['<ROOT>'],
    }]]);
    isValidTree.returns(false);
    this.stubs.push(isValidTree);
    test.deepEqual(BlueprintManager.parse(userInput), []);
    test.ok(BlueprintManager.isValidTree.calledTwice);
    test.ok(BlueprintManager.fillDefaults.calledTwice);
    test.done();
  },
  validateInputTest(test) {
    test.expect(4);
    test.throws(() => {
      BlueprintManager.validateInput([{ waitFor: ['<ROOT>'], requestId: '1' }]);
    }, Error);
    test.doesNotThrow(() => {
      BlueprintManager.validateInput([{
        action: 'view',
        uri: 'http://example.org',
      }]);
    }, Error);
    test.throws(() => {
      BlueprintManager.validateInput([{
        action: 'foo',
        uri: 'http://example.org',
      }]);
    }, Error);
    test.throws(() => {
      BlueprintManager.validateInput([{
        action: 'view',
        uri: 1,
      }]);
    }, Error);
    test.done();
  },
};
