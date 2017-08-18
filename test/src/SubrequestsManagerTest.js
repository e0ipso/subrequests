// Uncomment these two lines during test development for great debuggability.
// require('flow-remove-types/register');
// const SubrequestsManager = require('../../src/SubrequestsManager');
const SubrequestsManager = require('../../lib/SubrequestsManager');

const JsonPathReplacer = require('../../lib/JsonPathReplacer');
const HttpRequestor = require('../../lib/HttpRequestor');
const sinon = require('sinon');

module.exports = {
  setUp(cb) {
    this.requestor = new HttpRequestor();
    cb();
  },
  requestTest(test) {
    test.expect(1);
    const stub = sinon.stub(SubrequestsManager, '_processBatchesSequence').callsFake(() => null);
    this.stubs.push(stub);
    SubrequestsManager.request([], {});
    test.ok(SubrequestsManager._processBatchesSequence.called);
    test.done();
  },
  _processBatchesSequenceTest: {
    setUp(cb) {
      // Stub your dependencies.
      const replaceBatch = sinon.stub(JsonPathReplacer, 'replaceBatch');
      replaceBatch.callsFake(batch => batch);
      const requestInParallel = sinon.stub(this.requestor, 'requestInParallel');
      // Fake que HTTP responses.
      requestInParallel.callsFake(batch => batch
        .map(subrequest => {
          switch (subrequest.uri) {
            case 'test://req1':
              return { h: {}, b: 'resp1' };
            case 'test://req2':
              return { h: {}, b: 'resp2' };
            default:
              throw new Error('Unkown test request.');
          }
        })
        .map(response => Promise.resolve(response)));
      const _translateResponsesFromLibFormat = sinon.stub(SubrequestsManager, '_translateResponsesFromLibFormat');
      _translateResponsesFromLibFormat.callsFake(rs => rs.map(r => ({
        // Turn the simple object into a map.
        headers: new Map(Object.keys(r.h).map(k => [k, r.h[k]])),
        body: r.b,
      })));
      const _setRequestIdInResponses = sinon.stub(SubrequestsManager, '_setRequestIdInResponses');
      _setRequestIdInResponses.callsFake(item => item);

      // Put the stubs in the array so they can be asserted and reverted.
      this.stubs.push(replaceBatch);
      this.stubs.push(requestInParallel);
      this.stubs.push(_translateResponsesFromLibFormat);
      this.stubs.push(_setRequestIdInResponses);
      cb();
    },
    parallelBatch(test) {
      test.expect(6);
      const tree = [[
        { uri: 'test://req1' },
        { uri: 'test://req2' },
      ]];
      const spy = sinon.spy(SubrequestsManager, '_processBatchesSequence');
      SubrequestsManager._processBatchesSequence(tree, this.requestor)
        .then(processed => {
          test.deepEqual(processed, [
            {body: 'resp1', headers: new Map()},
            {body: 'resp2', headers: new Map()}
          ]);
          // Make sure all the stubs were called.
          this.stubs.forEach(stub => {
            test.ok(stub.called, `${stub.displayName} was not called.`);
          });
          // Make sure there is only one sequential call.
          test.ok(spy.calledOnce);
          test.done();
        })
        .then(() => {
          spy.restore();
        })
        .catch(err => console.error(err));
    },
    sequentialBatch(test) {
      test.expect(6);
      const spy = sinon.spy(SubrequestsManager, '_processBatchesSequence');
      const tree = [[ { uri: 'test://req1' } ], [ { uri: 'test://req2' } ]];
      SubrequestsManager._processBatchesSequence(tree, this.requestor)
        .then(processed => {
          test.deepEqual(processed, [
            {body: 'resp1', headers: new Map()},
            {body: 'resp2', headers: new Map()}
          ]);
          // Make sure all the stubs were called.
          this.stubs.forEach(stub => {
            test.ok(stub.called, `${stub.displayName} was not called.`);
          });
          // Make sure there are 2 sequential calls.
          test.ok(spy.calledTwice);
          test.done();
        })
        .then(() => {
          spy.restore();
        })
        .catch(err => console.error(err));
    }
  },
  _translateResponsesFromLibFormatTest(test) {
    test.expect(1);
    const translateResponseFromLibFormat = sinon.stub(this.requestor, 'translateResponseFromLibFormat');
    translateResponseFromLibFormat.callsFake(response => response);
    this.stubs.push(translateResponseFromLibFormat);
    SubrequestsManager._translateResponsesFromLibFormat([1, 2, 3, 4, 5], this.requestor);
    test.equal(5, translateResponseFromLibFormat.callCount);
    test.done();
  },
  _setRequestIdInResponsesTest(test) {
    test.expect(3);
    const _setRequestIdInResponse = sinon.stub(SubrequestsManager, '_setRequestIdInResponse');
    _setRequestIdInResponse.callsFake(() => null);
    this.stubs.push(_setRequestIdInResponse);
    SubrequestsManager._setRequestIdInResponses([
      { headers: new Map([['x-subrequest-id', 'foo']]) },
      { headers: new Map() }
    ]);
    test.equal(2, _setRequestIdInResponse.callCount);
    test.equal('foo', _setRequestIdInResponse.args[0][0]);
    test.equal('undefined', typeof _setRequestIdInResponse.args[1][0]);
    test.done();
  },
  _setRequestIdInResponseTest(test) {
    test.expect(2);
    const response = { headers: new Map() };
    SubrequestsManager._setRequestIdInResponse('lorem', response);
    test.equal('<lorem>', response.headers.get('Content-ID'));
    test.throws(() => {
      SubrequestsManager._setRequestIdInResponse(undefined, response);
    }, 'Error');
    test.done();
  }
};
