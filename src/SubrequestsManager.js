// @flow

import type { SubrequestsTree } from '../types/BlueprintManager';
import type { RequestorInterface } from '../types/Requestor';
import type { Response } from '../types/Responses';

const JsonPathReplacer = require('./JsonPathReplacer');

/**
 * @classdesc
 *   Handles all the sequential and parallel requests.
 *
 * @class SubrequestsManager
 */
module.exports = class SubrequestsManager {
  /**
   * Take a request tree and issue the subrequests with the requestor.
   *
   * @param {SubrequestsTree} tree
   *   The tree of subrequests.
   * @param {RequestorInterface} requestor
   *   The wrapper to resolve the requests.
   *
   * @return {Promise.<Response[]>}
   *   The responses for the requests.
   */
  static request(tree: SubrequestsTree, requestor: RequestorInterface): Promise<Array<Response>> {
    // Loop through all sequential requests and merge them.
    return this._processBatchesSequence(tree, requestor);
  }

  /**
   *
   *
   * @param {SubrequestsTree} tree
   *   The request tree that contains the requesting structure.
   * @param {RequestorInterface} requestor
   *   The wrapper around the request library to use.
   * @param {int} _sequence
   *   (internal) The current index in the sequential chain.
   * @param {Response[]} _responses
   *   (internal) The list of responses accumulated so far.
   *
   * @return {Promise.<Response[]>}
   *   A promise of an array of responses when everything has been resolved.
   *
   * @private
   */
  static _processBatchesSequence(
    tree: SubrequestsTree,
    requestor: RequestorInterface,
    _sequence: number = 0,
    _responses: Array<Response> = []
  ): Promise<Array<Response>> {
    let batch = tree[_sequence];
    // Perform all the necessary replacements for the elements in the batch.
    batch = JsonPathReplacer.replaceBatch(batch, _responses);
    return Promise.all(requestor.requestInParallel(batch))
      // Turn all the responses from whatever shape the HTTP library uses to the
      // shape in the Response type.
      .then(results => this._translateResponsesFromLibFormat(results, requestor))
      // Link each response with the request that initiated it.
      .then(this._setRequestIdInResponses.bind(this))
      // Now that the promise has resolved, issue the new request.
      .then((results) => {
        _responses = [..._responses, ...results];
        // If the last batch was processed then resolve the output. If not
        // then continue processing batches.
        _sequence += 1;
        return _sequence === tree.length
          ? Promise.resolve(_responses)
          : this._processBatchesSequence(tree, requestor, _sequence, _responses);
      });
  }

  /**
   * Takes a list of responses in the lib format and turns them into Response.
   * @param {Array} responses
   *   An array of responses in whatever format the requestor library expects
   *   them.
   * @param {RequestorInterface} requestor
   *   The requestor that resolved the request.
   *
   * @returns {Response[]}
   *   The list of responses in the canonical form.
   *
   * @private
   */
  static _translateResponsesFromLibFormat(
    responses: Array<*>,
    requestor: RequestorInterface
  ): Array<Response> {
    return responses.map(response => requestor.translateResponseFromLibFormat(response));
  }

  /**
   * Sets the ID of the request that originated the response in Content-ID.
   *
   * @param {Response[]} responses
   *   The responses to alter.
   *
   * @returns {Response[]}
   *   The altered responses.
   *
   * @private
   */
  static _setRequestIdInResponses(responses: Array<Response>): Array<Response> {
    return responses.map((response) => {
      this._setRequestIdInResponse(response.headers.get('x-subrequest-id'), response);
      return response;
    });
  }

  /**
   * Puts the request ID in the response so a consumer.
   *
   * This way a consumer can know what part of the subrequest was initiated by
   * what request.
   *
   * @param {string} requestId
   *   The content id.
   * @param {Response} response
   *   The response object we are dealing with.
   *
   * @return {void}
   *
   * @private
   */
  static _setRequestIdInResponse(requestId: ?string, response: Response): void {
    if (!requestId) {
      throw new Error(`Unable to find the requestId for response "${JSON.stringify(response)}".`);
    }
    response.headers.set('Content-ID', `<${requestId}>`);
  }
};
