// Uncomment these two lines during test development for great debuggability.
// require('flow-remove-types/register');
// const MultipartRelatedResponse = require('../../src/MultipartRelatedResponse');
const MultipartRelatedResponse = require('../../lib/MultipartRelatedResponse');

const sinon = require('sinon');

module.exports = {
  setUp(cb) {
    this.reponses = [
      {
        headers: new Map([['foo', 'bar'], ['Content-Type', 'rab']]),
        body: 'Lorem',
      },
      {
        headers: new Map([['asd', 'fgh'], ['content-type', 'hgf']]),
        body: 'Ipsum',
      },
    ];
    Date.now = sinon.stub();
    Date.now.returns(1502200342117);
    this.stubs.push(Date.now);
    cb();
  },
  _generateDelimiterTest(test) {
    test.expect(1);
    test.equal(MultipartRelatedResponse._generateDelimiter(), 'a41f80');
    test.done();
  },
  serializeResponseTest(test) {
    test.expect(1);
    const serialized = MultipartRelatedResponse.serializeResponse(this.reponses[0]);
    test.equal(serialized, 'foo: bar\r\nContent-Type: rab\r\n\r\nLorem');
    test.done();
  },
  _cleanResponseTest(test) {
    test.expect(2);
    let body = '\n\rL\r\nO\r\n';
    test.deepEqual(MultipartRelatedResponse._cleanResponse({ body }), { body: '\n\rL\r\nO' });
    body = '\n\rL\r\nOREM';
    test.deepEqual(MultipartRelatedResponse._cleanResponse({ body }), { body: '\n\rL\r\nOREM' });
    test.done();
  },
  mergeResponsesTest(test) {
    test.expect(1);
    const expected = {
      headers: new Map([
        ['Status', '207'],
        ['Content-Type', 'multipart/related; boundary="a41f80"; type="application/json"'],
      ]),
      body: 'a41f80--\r\nfoo: bar\r\nContent-Type: rab\r\n\r\nLorem\r\n--a41f80\r\nasd: fgh\r\ncontent-type: hgf\r\n\r\nIpsum\r\n--a41f80--',
    };
    test.deepEqual(MultipartRelatedResponse.mergeResponses(this.reponses), expected);
    test.done();
  },
  _negotiateSubContentTypeTest(test) {
    test.expect(1);
    const contentType = MultipartRelatedResponse._negotiateSubContentType([
      { headers: new Map() },
    ]);
    test.equal(contentType, 'application/json');
    test.done();
  },
};
