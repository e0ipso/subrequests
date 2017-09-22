// Uncomment these two lines during test development for great debuggability.
// require('flow-remove-types/register');
// const JsonPathReplacer = require('../../src/JsonPathReplacer');
const JsonPathReplacer = require('../../lib/JsonPathReplacer');

const sinon = require('sinon');

module.exports = {
  setUp(cb) {
    this.pool = [
      {
        body: '{"foo":"bar","oof":[{"id":"rab"},{"id":"zab"}]}',
        headers: new Map([['Content-ID', '<req1#12#4>']]),
      },
      {
        body: '{"lorem":["ipsum","dolor"]}',
        headers: new Map([['Content-ID', '<reqB#0>']]),
      },
      {
        body: '{"rab":["success!","yay!"],"zab":"success!"}',
        headers: new Map([['Content-ID', '<reqIII>']]),
      },
    ];
    cb();
  },
  replaceBatchTest(test) {
    test.expect(2);
    this.stubs.push(sinon.stub(JsonPathReplacer, 'replaceItem'));
    JsonPathReplacer.replaceItem.callsFake(subrequest => [subrequest]);
    const replaced = JsonPathReplacer.replaceBatch([{ foo: 'bar' }, { lorem: 'ipsum' }]);
    test.deepEqual(replaced, [{ foo: 'bar' }, { lorem: 'ipsum' }]);
    test.ok(JsonPathReplacer.replaceItem.calledTwice);
    test.done();
  },
  replaceItemTest: {
    noReplacements(test) {
      test.expect(2);
      this.stubs.push(sinon.stub(JsonPathReplacer, '_extractTokenReplacements'));
      JsonPathReplacer._extractTokenReplacements.callsFake(() => new Map());
      const replaced = JsonPathReplacer.replaceItem({ foo: 'bar' });
      test.deepEqual(replaced, [{ foo: 'bar', _resolved: true }]);
      test.ok(JsonPathReplacer._extractTokenReplacements.calledTwice);
      test.done();
    },
    simpleReplacements(test) {
      test.expect(1);
      const subrequest = {
        requestId: 'my-request',
        action: 'view',
        uri: 'test://{{req1.body@$.foo}}',
      };
      const replaced = JsonPathReplacer.replaceItem(subrequest, this.pool);
      test.deepEqual(replaced, [{
        _resolved: true,
        action: 'view',
        uri: 'test://bar',
        requestId: 'my-request#uri{0}',
      }]);
      test.done();
    },
    manyOtherReplacements(test) {
      test.expect(1);
      const subrequest = {
        requestId: 'my-request',
        action: 'create',
        uri: 'test',
        body: { merol: '{{reqB.body@$.lorem[*]}}', oof: '{{reqB.body@$.foo}}' },
      };
      const pool = [{
        body: '{"lorem":["ipsum","dolor"],"foo":"bar"}',
        headers: new Map([['Content-ID', '<reqB#0>']]),
      }, {
        body: '{"lorem":["2nd-ipsum","2nd-dolor","2nd-sid"],"foo":"rab"}',
        headers: new Map([['Content-ID', '<reqB#1>']]),
      }];
      const replaced = JsonPathReplacer.replaceItem(subrequest, pool);
      test.deepEqual(replaced, [
        {
          requestId: 'my-request#body{0}',
          action: 'create',
          uri: 'test',
          body: { merol: 'ipsum', oof: 'bar' },
          _resolved: true,
        },
        {
          requestId: 'my-request#body{1}',
          action: 'create',
          uri: 'test',
          body: { merol: 'dolor', oof: 'bar' },
          _resolved: true,
        },
        {
          requestId: 'my-request#body{0}',
          action: 'create',
          uri: 'test',
          body: { merol: '2nd-ipsum', oof: 'rab' },
          _resolved: true,
        },
        {
          requestId: 'my-request#body{1}',
          action: 'create',
          uri: 'test',
          body: { merol: '2nd-dolor', oof: 'rab' },
          _resolved: true,
        },
        {
          requestId: 'my-request#body{2}',
          action: 'create',
          uri: 'test',
          body: { merol: '2nd-sid', oof: 'rab' },
          _resolved: true,
        },
      ]);
      test.done();
    },
    manyReplacements(test) {
      test.expect(1);
      const subrequest = {
        requestId: 'my-request',
        action: 'create',
        uri: 'test://{{req1.body@$.oof[*].id}}/{{req1.body@$.oof[*].id}}/{{req1.body@$.foo}}',
        body: { oof: '{{reqB.body@$.lorem[*]}}' },
      };
      const replaced = JsonPathReplacer.replaceItem(subrequest, this.pool);
      test.deepEqual(replaced, [
        {
          requestId: 'my-request#uri{0}#body{0}',
          action: 'create',
          uri: 'test://rab/rab/bar',
          body: { oof: 'ipsum' },
          _resolved: true,
        },
        {
          requestId: 'my-request#uri{0}#body{1}',
          action: 'create',
          uri: 'test://rab/rab/bar',
          body: { oof: 'dolor' },
          _resolved: true,
        },
        {
          requestId: 'my-request#uri{1}#body{0}',
          action: 'create',
          uri: 'test://zab/zab/bar',
          body: { oof: 'ipsum' },
          _resolved: true,
        },
        {
          requestId: 'my-request#uri{1}#body{1}',
          action: 'create',
          uri: 'test://zab/zab/bar',
          body: { oof: 'dolor' },
          _resolved: true,
        },
      ]);
      test.done();
    },
  },
  _extractTokenReplacementsTest: {
    success(test) {
      test.expect(2);
      const subrequest = {
        action: 'create',
        uri: 'test://{{req1.body@$.foo}}',
        body: { oof: '{{reqB.body@$.lorem[*]}}' },
      };
      const replacementsUri = JsonPathReplacer._extractTokenReplacements(
        subrequest,
        'uri',
        this.pool
      );
      const replacementsBody = JsonPathReplacer._extractTokenReplacements(
        subrequest,
        'body',
        this.pool
      );
      test.deepEqual(replacementsUri, {
        'req1#12#4': { '{{req1.body@$.foo}}': ['bar'] },
      });
      test.deepEqual(replacementsBody, {
        'reqB#0': { '{{reqB.body@$.lorem[*]}}': ['ipsum', 'dolor'] },
      });
      test.done();
    },
    error(test) {
      test.expect(1);
      const subrequest = {
        action: 'view',
        uri: 'test://{{reqC.body@$.foo}}',
      };
      test.throws(() => {
        JsonPathReplacer._extractTokenReplacements(subrequest, 'uri', this.pool);
      }, 'Error');
      test.done();
    },
  },
  _validateJsonPathReplacementsTest(test) {
    test.expect(3);
    test.doesNotThrow(() => JsonPathReplacer._validateJsonPathReplacements(
      ['foo', 'bar']
    ));
    test.throws(() => JsonPathReplacer
      ._validateJsonPathReplacements({ foo: 'bar' }), 'Error');
    test.throws(() => JsonPathReplacer._validateJsonPathReplacements([
      'foo',
      { lorem: 'ipsum' },
      'bar',
    ]), 'Error');
    test.done();
  },
  _getContentIdTest(test) {
    test.expect(2);
    let headers = new Map([['Content-ID', '<foo>']]);
    test.equal(JsonPathReplacer._getContentId({ headers }), 'foo');
    headers = new Map();
    test.equal(JsonPathReplacer._getContentId({ headers }), '');
    test.done();
  },
};
