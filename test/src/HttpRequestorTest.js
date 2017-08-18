// Uncomment these two lines during test development for great debuggability.
// require('flow-remove-types/register');
// const HttpRequestor = require('../../src/HttpRequestor');
const HttpRequestor = require('../../lib/HttpRequestor');

const sinon = require('sinon');
const request = require('request');

module.exports = {
  setUp(cb) {
    this.requestor = new HttpRequestor();
    cb();
  },
  requestInParallelTest: {
    setUp(cb) {
      this.stubs.push(sinon.stub(request, 'post'));
      request.post.callsFake((uri, options, cb) => {
        const fakeResponse = {
          req: { _headers: { 'x-subrequest-id': 'foo' }, options },
          headers: {},
          rawHeaders: [],
        };
        let expectedOptions;
        switch (uri) {
          case 'test://lorem':
            cb(null, fakeResponse);
            break;
          case 'test://ipsum':
            fakeResponse.req._headers['x-subrequest-id'] = 'bar';
            cb(null, fakeResponse);
            break;
          default:
            cb(new Error('Fffffu'));
            break;
        }
      });
      cb();
    },
    success(test) {
      test.expect(4);
      Promise.all(this.requestor.requestInParallel([
        {
          requestId: 'req1',
          action: 'create',
          uri: 'test://lorem?ipsum=dolor&amet=ra',
          headers: new Map([['content-type', 'application/json']]),
          body: { hey: 'ho', lets: 'go' },
        },
        {
          requestId: 'req2',
          action: 'create',
          uri: 'test://ipsum',
          headers: new Map(),
        },
      ]))
        .then((all) => {
          test.equal(all[0].headers['x-subrequest-id'], 'foo');
          let expectedOptions = {
            headers: {
              'content-type': 'application/json',
              'x-subrequest-id': 'req1'
            },
            qs: { ipsum: 'dolor', amet: 'ra' },
            json: true,
            body: { hey: 'ho', lets: 'go' },
          };
          test.deepEqual(all[0].req.options, expectedOptions);
          test.equal(all[1].headers['x-subrequest-id'], 'bar');
          expectedOptions = {
            headers: {'x-subrequest-id': 'req2'},
            qs: {},
            json: false
          };
          test.deepEqual(all[1].req.options, expectedOptions);
          test.done();
        })
        .catch(err => console.error(err));
    },
    fail(test) {
      test.expect(1);
      Promise.all(this.requestor.requestInParallel([{
        requestId: 'req3',
        action: 'create',
        uri: 'test://404',
        headers: new Map(),
      }]))
        .catch((error) => {
          test.equal(error.message, 'Fffffu');
          test.done();
        });
    }
  },
  translateResponseFromLibFormatTest(test) {
    test.expect(1);
    const response = {
      headers: { lorem: 'ipsum', foo: 'bar' },
      body: 'Hello World!',
    };
    const translated = this.requestor.translateResponseFromLibFormat(response);
    test.deepEqual(translated, {
      headers: new Map([['lorem', 'ipsum'], ['foo', 'bar']]),
      body: 'Hello World!',
    });
    test.done();
  },
  _actionToMethodTest(test) {
    test.expect(8);
    test.equal(HttpRequestor._actionToMethod('view'), 'GET');
    test.equal(HttpRequestor._actionToMethod('create'), 'POST');
    test.equal(HttpRequestor._actionToMethod('update'), 'PATCH');
    test.equal(HttpRequestor._actionToMethod('replace'), 'PUT');
    test.equal(HttpRequestor._actionToMethod('delete'), 'DELETE');
    test.equal(HttpRequestor._actionToMethod('exists'), 'HEAD');
    test.equal(HttpRequestor._actionToMethod('discover'), 'OPTIONS');
    test.throws(() => HttpRequestor._actionToMethod('foo'), 'Error');
    test.done();
  },
};
