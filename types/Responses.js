// @flow

export type Response = {
  body: string,
  headers: Map<string, string>,
};

export interface ResponseMergerInterface {

  /**
   * Merges many responses into a single one.
   *
   * @param {Response[]} responses
   *   An object containing information about the response body and headers.
   *
   * @return {Response}
   *   A single response containing all the responses.
   */
  static mergeResponses(responses: Array<Response>): Response;

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
  static serializeResponse(response: Response): string;

}
