// @flow

import type { RequestorInterface } from '../types/Requestor';
import type { Response, ResponseMergerStaticsInterface } from '../types/Responses';

const BlueprintManager = require('./BlueprintManager');
const HttpRequestor = require('./HttpRequestor');
const JsonPathReplacer = require('./JsonPathReplacer');
const MultipartRelatedResponse = require('./MultipartRelatedResponse');
const ResponseMergerBase = require('./ResponseMergerBase');
const SubrequestsManager = require('./SubrequestsManager');

/**
 * Execute a blueprint of requests using a requestor, get a single response.
 *
 * @param {string} blueprint
 *   The tree of requests in the expected blueprint format.
 * @param {RequestorInterface} requestor
 *   The wrapped HTTP library to execute all communications.
 * @param {function} MergerClass
 *   The class with static methods to merge all the subresponses into one.
 *
 * @return {Promise.<string>}
 *   The promise of a single response.
 */
function request(
  blueprint: string,
  requestor: RequestorInterface = new HttpRequestor(),
  MergerClass: ResponseMergerStaticsInterface = MultipartRelatedResponse
): Promise<Response> {
  // Parse the blueprint to build the request tree.
  const tree = BlueprintManager.parse(blueprint);
  // Make all the sequential requests that, in turn, contain parallel requests.
  return SubrequestsManager.request(tree, requestor)
    // Merge all the responses into a single response string.
    .then(subresponses => MergerClass.mergeResponses(subresponses));
}

/**
 * Execute a blueprint of requests using a requestor, get an array of responses.
 *
 * @param {string} blueprint
 *   The tree of requests in the expected blueprint format.
 * @param {RequestorInterface} requestor
 *   The wrapped HTTP library to execute all communications.
 *
 * @return {Promise.<string>}
 *   The promise of a single response.
 */
function requestArray(
  blueprint: string,
  requestor: RequestorInterface = new HttpRequestor()
): Promise<Array<Response>> {
  // Parse the blueprint to build the request tree.
  const tree = BlueprintManager.parse(blueprint);
  // Make all the sequential requests that, in turn, contain parallel requests.
  return SubrequestsManager.request(tree, requestor);
}

module.exports = {
  request,
  requestArray,
  lib: {
    BlueprintManager,
    HttpRequestor,
    JsonPathReplacer,
    MultipartRelatedResponse,
    ResponseMergerBase,
    SubrequestsManager,
  },
};
