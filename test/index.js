const BlueprintManager = require('./src/BlueprintManagerTest');
const HttpRequestor = require('./src/HttpRequestorTest');
const JsonPathReplacer = require('./src/JsonPathReplacerTest');
const main = require('./src/indexTest');
const SubrequestsManager = require('./src/SubrequestsManagerTest');
const MultipartRelatedResponse = require('./src/MultipartRelatedResponseTest');

module.exports = {
  setUp(cb) {
    this.stubs = [];

    this.stubWithPromise = (objToStub, functionName) => {
      const stub = sinon.stub(objToStub, functionName);
      stub.returns(Promise.resolve());
      this.stubs.push(stub);
    };

    cb();
  },

  tearDown(cb) {
    this.stubs.forEach((stub) => {
      if (typeof stub.restore === 'function') {
        stub.restore();
      }
    });
    this.stubs = [];

    cb();
  },
  BlueprintManager,
  HttpRequestor,
  JsonPathReplacer,
  SubrequestsManager,
  MultipartRelatedResponse,
  main,
};
