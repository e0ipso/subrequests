// @flow

import type { Response } from '../types/Responses';

/**
 * @classdesc
 *   Holds common methods for the different responses mergers.
 *
 * @class
 *   ResponseMergerBase
 *
 * @abstract
 */
class ResponseMergerBase {

  /**
   * Carriage return line feed.
   *
   * @return {string}
   *   The string.
   */
  static getCrlf(): string {
    return '\r\n';
  }

  /**
   * Clean a response to a subrequest.
   *
   * @param {Response} response
   *   The response to clean.
   *
   * @return {Response}
   *   The clean response.
   *
   * @private
   */
  static _cleanResponse(response: Response): Response {
    response.body = response.body.replace(new RegExp(`${this.getCrlf()}$`), '');
    return response;
  }

  /**
   * Negotiates the sub Content-Type.
   *
   * Checks if all responses have the same Content-Type header. If they do, then
   * it returns that one. If not, it defaults to 'application/json'.
   *
   * @param {Response[]} responses
   *   The responses.
   *
   * @return {string}
   *   The collective content type. 'application/json' if no conciliation is
   *   possible.
   *
   * @private
   */
  static _negotiateSubContentType(responses: Array<Response>): string {
    let output = null;
    responses.forEach((response) => {
      const ct = response.headers.get('Content-Type') || response.headers.get('content-type');
      if (output === null) {
        output = ct;
      }
      if (output !== ct) {
        output = 'application/json';
      }
    });
    return output || 'application/json';
  }

}

module.exports = ResponseMergerBase;
