// @flow

import type { Subrequest } from './BlueprintManager';
import type { Response } from './Responses';

export interface RequestorInterface {

  /**
   * Makes multiple requests in parallel.
   *
   * @param {Subrequest[]} subrequests
   *   The list of requests to make.
   *
   * @return {Promise.<Response[]>}
   *   The responses to the requests.
   */
  requestInParallel(subrequests: Array<Subrequest>): Array<Promise<Response>>;

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
  translateResponseFromLibFormat(response: mixed): Response;

}
