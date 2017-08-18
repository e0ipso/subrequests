// @flow

import type { Response, ResponseMergerInterface } from '../types/Responses';

const contentType = require('content-type');
const ResponseMergerBase = require('./ResponseMergerBase');

const md5 = require('md5');

/**
 * @classdesc
 *   Takes in a collection of sub-responses and assembles a single response.
 *
 * @class MultipartRelatedResponse
 */
module.exports = class MultipartRelatedResponse extends ResponseMergerBase implements ResponseMergerInterface {
  /**
   * Merges many responses into a single one.
   *
   * @param {Response[]} responses
   *   An object containing information about the response body and headers.
   *
   * @return {Response}
   *   A single response containing all the responses.
   */
  static mergeResponses(responses: Array<Response>): Response {
    const delimiter = this._generateDelimiter();
    const crlf = this.getCrlf();
    const headers = new Map();
    // The status is always set to multi-status.
    headers.set('Status', '207');
    // The content type contains the delimiter.
    const ct = contentType.format({
      type: 'multipart/related',
      parameters: {
        boundary: delimiter,
        type: this._negotiateSubContentType(responses),
      },
    });
    // The content type: 'multipart/related; boundary=1234; type=text/plain'
    headers.set('Content-Type', ct);
    const output: Response = {
      headers,
      body: '',
    };

    const parts = responses
      .map(this._cleanResponse.bind(this))
      .map(this.serializeResponse.bind(this));

    // Put the correct delimiters in place for the `multipart/related`
    output.body += `${delimiter}--${crlf}`;
    output.body += parts.join(`${crlf}--${delimiter}${crlf}`);
    output.body += `${crlf}--${delimiter}--`;
    return output;
  }

  /**
   * Builds a subresponse object based on the response to the subrequest.
   *
   * @param {Response} response
   *   The individual subresponse.
   *
   * @return {string}
   *   The serialized subresponse.
   *
   *  @private
   */
  static serializeResponse(response: Response): string {
    let output = '';
    // Encode the response headers in the output.
    const crlf = this.getCrlf();
    response.headers.forEach((value, name) => {
      output += `${name}: ${value}${crlf}`;
    });

    return `${output}${crlf}${response.body}`;
  }

  /**
   * Generate a random subresponse delimiter.
   *
   * @return {string}
   *   The hex delimiter.
   *
   * @private
   */
  static _generateDelimiter(): string {
    return md5(Date.now()).substr(0, 6);
  }
};
