// @flow

import type { Subrequest } from '../types/BlueprintManager';
import type { Response } from '../types/Responses';
import type { RequestorInterface } from '../types/Requestor';

const request = require('request');
const querystring = require('querystring');

/**
 * @classdesc
 *   Make subrequests via HTTP.
 *
 * This is the most basic requestor, typically you will want to override this to
 * make sure that you can optimize for your stack. Examples of these are:
 * cache-wrapped subrequests, resolve requests locally when the request is for
 * the current server, multiplex unix socket connections with HTTP ones, …
 *
 * @class HttpRequestor
 */
module.exports = class HttpRequestor implements RequestorInterface {
  /**
   * Makes multiple requests in parallel.
   *
   * @param {Subrequest[]} subrequests
   *   The list of requests to make.
   *
   * @return {Promise.<Response[]>}
   *   The responses to the requests.
   */
  requestInParallel(subrequests: Array<Subrequest>): Array<Promise<Response>> {
    return subrequests.map((subrequest) => {
      // Build the request options.
      const parts = subrequest.uri.split('?');
      const uri = parts[0];
      const qs = querystring.parse(parts[1] || '');
      const options: Object = {
        // Add a custom request header to identify the subrequest.
        headers: { 'x-subrequest-id': subrequest.requestId },
        qs,
      };
      subrequest.headers.forEach((value, name) => {
        options.headers[name] = value;
      });
      // Set the `json` option if applicable.
      const contentType = subrequest.headers.get('Content-Type')
        || subrequest.headers.get('content-type') || '';
      options.json = !!contentType.match(new RegExp('[/\+]json$')); // eslint-disable-line no-useless-escape
      if (subrequest.body) {
        options.body = subrequest.body;
      }

      const method = this.constructor._actionToMethod(subrequest.action).toLowerCase();
      return this._individualRequest(method, uri, options, subrequest.requestId);
    });
  }

  /**
   * Execute an individual request.
   *
   * @param {string} method
   *   The HTTP method.
   * @param {string} uri
   *   The URI to make the request against.
   * @param {Object} options
   *   A list of options for the requesting library.
   * @param {string} subrequestId
   *   The ID of the request being made.
   *
   * @returns {Promise<Response>}
   *   A response promise.
   *
   * @private
   */
  _individualRequest(
    method: string,
    uri: string,
    options: Object,
    subrequestId: string
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      request[method](uri, options, (error, response) => {
        if (error) {
          reject(error);
        }
        else {
          this._setSubrequestResponseHeader(response, subrequestId);
          resolve(response);
        }
      });
    });
  }

  /**
   * Translate the response from the lib format into the typed Response object.
   *
   * Responses come back as an object defined in the request module. We want to
   * transform them into the typed object.
   *
   * @param {*} response
   *   The response in the library object.
   *
   * @return {Response}
   *   The response in the common structure.
   */
  translateResponseFromLibFormat(response: *): Response {
    // Translate the headers from an object to a Map.
    const headers = new Map(Object.keys(response.headers)
      .map(name => [name, response.headers[name]]));
    return { headers, body: response.body };
  }

  /**
   * Set the subrequest ID in the response object.
   *
   * This is used later on for ID purposes when replacing data based on this
   * response down the road.
   *
   * @param {*} response
   *   The response in the library object.
   * @param {string} id
   *   The request ID in memory.
   *
   * @return {void}
   *
   * @private
   */
  _setSubrequestResponseHeader(response: *, id: string): void { // eslint-disable-line no-unused-vars
    // In this case we prefer setting the id from the request object inside the
    // response, for consistency.
    const subrequestId: string = response.req._headers['x-subrequest-id'];
    response.headers['x-subrequest-id'] = subrequestId;
    response.rawHeaders.push('x-subrequest-id');
    response.rawHeaders.push(subrequestId);
  }

  /**
   * Translate Subrequests specification actions into HTTP methods.
   *
   * @param {string} action
   *   The action
   *
   * @return {string}
   *   The HTTP method. Capitalized.
   *
   * @private
   */
  static _actionToMethod(action: string): string {
    // For good old HTTP the actions cleanly map to HTTP methods.
    switch (action) {
      case 'view':
        return 'GET';
      case 'create':
        return 'POST';
      case 'update':
        return 'PATCH';
      case 'replace':
        return 'PUT';
      case 'delete':
        return 'DELETE';
      case 'exists':
        return 'HEAD';
      case 'discover':
        return 'OPTIONS';
      default:
        throw new Error('Unexpected action. Impossible to map to an HTTP method.');
    }
  }
};
