// Uncomment these two lines during test development for great debuggability.
// require('flow-remove-types/register');
// const main = require('../../src');
const main = require('../../lib');
const BlueprintManager = require('../../lib/BlueprintManager');
const SubrequestsManager = require('../../lib/SubrequestsManager');
const MultipartRelatedResponse = require('../../lib/MultipartRelatedResponse');

const sinon = require('sinon');

module.exports = {
  requestTest(test) {
    test.expect(3);
    this.stubs.push(sinon.stub(BlueprintManager, 'parse'));
    BlueprintManager.parse.callsFake(() => null);
    this.stubs.push(sinon.stub(SubrequestsManager, 'request'));
    SubrequestsManager.request.callsFake(() => Promise.resolve());
    this.stubs.push(sinon.stub(MultipartRelatedResponse, 'mergeResponses'));
    MultipartRelatedResponse.mergeResponses.callsFake(() => null);
    main.request().then(() => {
      test.ok(BlueprintManager.parse.called);
      test.ok(SubrequestsManager.request.called);
      test.ok(MultipartRelatedResponse.mergeResponses.called);
      test.done();
    });
  },
  requestArrayTest(test) {
    test.expect(3);
    this.stubs.push(sinon.stub(BlueprintManager, 'parse'));
    BlueprintManager.parse.callsFake(() => null);
    this.stubs.push(sinon.stub(SubrequestsManager, 'request'));
    SubrequestsManager.request.callsFake(() => Promise.resolve());
    main.requestArray().then(() => {
      test.ok(BlueprintManager.parse.called);
      test.ok(SubrequestsManager.request.called);
      test.ok(!MultipartRelatedResponse.mergeResponses.called);
      test.done();
    });
  }
};
