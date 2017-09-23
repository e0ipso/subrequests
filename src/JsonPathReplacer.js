// @flow

import type { Subrequest } from '../types/BlueprintManager';
import type { TokenReplacements, Point } from '../types/JsonPathReplacer';
import type { Response } from '../types/Responses';

const _ = require('lodash');
const jsonpath = require('jsonpath');

/**
 * @classdesc
 *   In charge of replacing tokenized subrequests in as many requests as needed.
 *
 * Each subrequest can generate NxM copies of itself. N if the token refers to a
 * subrequest that generated many responses previously. M if the replacement
 * token resolves to a multivalue field that leads to many replacements.
 *
 * @class JsonPathReplacer
 */
module.exports = class JsonPathReplacer {
  /**
   * Searches for JSONPath tokens in the requests and replaces them with the
   * values from previous responses.
   *
   * @param {Subrequest[]} batch
   *   The list of requests that can contain tokens.
   * @param {Response[]} pool
   *   The pool of responses that can content the values to replace.
   *
   * @returns {Subrequest[]}
   *   The new list of requests. Note that if a JSONPath token yields many
   *   values then several replaced subrequests will be generated from that
   *   single subrequest.
   */
  static replaceBatch(batch: Array<Subrequest>, pool: Array<Response>): Array<Subrequest> {
    // Apply replacements to each one of the items.
    return batch.reduce(
      (carry: Array<Subrequest>, subrequest: Subrequest) =>
        [...carry, ...(this.replaceItem(subrequest, pool))],
      []
    );
  }

  /**
   * Searches for JSONPath tokens in the request and replaces it with the values
   * from previous responses.
   *
   * @param {Subrequest} subrequest
   *   The list of requests that can contain tokens.
   * @param {Response[]} pool
   *   The pool of responses that can content the values to replace.
   *
   * @returns {Subrequest[]}
   *   The new list of requests. Note that if a JSONPath token yields many
   *   values then several replaced subrequests will be generated from the input
   *   subrequest.
   */
  static replaceItem(subrequest: Subrequest, pool: Array<Response>): Array<Subrequest> {
    const tokenReplacements = {
      uri: this._extractTokenReplacements(subrequest, 'uri', pool),
      body: this._extractTokenReplacements(subrequest, 'body', pool),
    };
    if (Object.keys(tokenReplacements.uri).length !== 0) {
      return this.replaceBatch(
        this._doReplaceTokensInLocation(tokenReplacements, subrequest, 'uri'),
        pool
      );
    }
    if (Object.keys(tokenReplacements.body).length !== 0) {
      return this.replaceBatch(
        this._doReplaceTokensInLocation(tokenReplacements, subrequest, 'body'),
        pool
      );
    }
    // If there are no replacements necessary, then just return the initial
    // request.
    return [Object.assign(subrequest, { _resolved: true })];
  }

  /**
   * Creates replacements for either the body or the URI.
   *
   * @param {Object<string, TokenReplacements>} tokenReplacements
   *   Holds the info to replace text.
   * @param {Subrequest} tokenizedSubrequest
   *   The original copy of the subrequest.
   * @param {string} tokenLocation
   *   Either 'body' or 'uri'.
   *
   * @returns {Subrequest[]}
   *   The replaced subrequests.
   *
   * @private
   */
  static _doReplaceTokensInLocation(
    tokenReplacements: {uri: TokenReplacements, body: TokenReplacements},
    tokenizedSubrequest: Subrequest,
    tokenLocation: ('uri' | 'body')
  ): Array<Subrequest> {
    const replacements: Array<Subrequest> = [];
    const tokensPerContentId = tokenReplacements[tokenLocation];
    let index = 0;
    // First figure out the different token resolutions and their token.
    const groupedByToken = [];
    Object.keys(tokensPerContentId).forEach((contentId) => {
      const resolutionsPerToken = tokensPerContentId[contentId];
      Object.keys(resolutionsPerToken).forEach((token) => {
        const resolutions = resolutionsPerToken[token];
        groupedByToken.push(resolutions.map(value => ({ token, value })));
      });
    });
    // Then calculate the points.
    const points = this._getPoints(groupedByToken);
    points.forEach((point) => {
      // Clone the subrequest.
      const cloned = _.cloneDeep(tokenizedSubrequest);
      cloned.requestId = `${tokenizedSubrequest.requestId}#${tokenLocation}{${index}}`;
      index += 1;
      // Now replace all the tokens in the request member.
      let tokenSubject = this._serializeMember(tokenLocation, cloned[tokenLocation]);
      point.forEach((replacement) => {
        // Do all the different replacements on the same subject.
        tokenSubject = this._replaceTokenSubject(
          replacement.token,
          replacement.value,
          tokenSubject
        );
      });
      cloned[tokenLocation] = this._deserializeMember(tokenLocation, tokenSubject);
      replacements.push(cloned);
    });
    return replacements;
  }

  /**
   * Does the replacement on the token subject.
   *
   * @param {string} token
   *   The thing to replace.
   * @param {string} value
   *   The thing to replace it with.
   * @param {int} tokenSubject
   *   The thing to replace it on.
   *
   * @returns {string}
   *   The replaced string.
   *
   * @private
   */
  static _replaceTokenSubject(
    token: string,
    value: string,
    tokenSubject: string
  ): string {
    // Escape regular expression.
    const regexp = new RegExp(token.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1'), 'g');
    return tokenSubject.replace(regexp, value);
  }

  /**
   * Generates a list of sets of coordinates for the token replacements.
   *
   * Each point (coordinates set) end up creating a new clone of the tokenized
   * subrequest.
   *
   * @param {Array<Array<Object>>} groupedByToken
   *   Array of replacements keyed by token.
   *
   * @return {Array<Point>}
   *   The coordinates sets.
   */
  static _getPoints(groupedByToken: Array<Array<{
    token: string,
    value: string,
  }>>): Array<Point> {
    const currentGroup = groupedByToken[0];
    // If this is not the last group, then call recursively.
    if (groupedByToken.length === 1) {
      return currentGroup.map(item => [item]);
    }
    const remaining = groupedByToken.slice(1);
    const points = [];
    currentGroup.forEach((resolutionInfo) => {
      // Get all the combinations for the next groups.
      const nextPoints = this._getPoints(remaining);
      nextPoints.forEach((nextPoint) => {
        // Prepend the current resolution for each point.
        points.push([resolutionInfo].concat(nextPoint));
      });
    });
    return points;
  }

  /**
   * Makes sure that the subject for replacement is a string.
   *
   * This is an abstraction to be able to treat 'uri' and 'body' replacements
   * the same way.
   *
   * @param {string} memberName
   *   Either 'body' or 'uri'.
   * @param {*} value
   *   The contents of the URI or the subrequest body.
   *
   * @returns {string}
   *   The serialized member.
   *
   * @private
   */
  static _serializeMember(memberName: ('body' | 'uri'), value: *): string {
    return memberName === 'body'
      // The body is an Object, to replace on it we serialize it first.
      ? JSON.stringify(value)
      : value;
  }

  /**
   * Undoes the serialization that happened in _serializeMember.
   *
   * This is an abstraction to be able to treat 'uri' and 'body' replacements
   * the same way.
   *
   * @param {string} memberName
   *   Either 'body' or 'uri'.
   * @param {string} serialized
   *   The contents of the serialized URI or the serialized subrequest body.
   *
   * @returns {*}
   *   The unserialized member.
   *
   * @private
   */
  static _deserializeMember(memberName: string, serialized: string): * {
    return memberName === 'body'
      // Deserialize the body to store it back.
      ? JSON.parse(serialized)
      : serialized;
  }

  /**
   * Extracts the token replacements for a given subrequest.
   *
   * Given a subrequest there can be N tokens to be replaced. Each token can
   * result in an list of values to be replaced. Each token may refer to many
   * subjects, if the subrequest referenced in the token ended up spawning
   * multiple responses. This function detects the tokens and finds the
   * replacements for each token. Then returns a data structure that contains a
   * list of replacements. Each item contains all the replacement needed to get
   * a response for the initial request, given a particular subject for a
   * particular JSONPath replacement.
   *
   * @param {Subrequest} subrequest
   *   The subrequest that contains the tokens.
   * @param {string} tokenLocation
   *   Indicates if we are dealing with body or URI replacements.
   * @param {Response[]} pool
   *   The collection of prior responses available for use with JSONPath.
   *
   * @returns {TokenReplacements}
   *   The structure containing a list of replacements for a subject response
   *   and a replacement candidate.
   *
   * @private
   */
  static _extractTokenReplacements(
    subrequest: Subrequest,
    tokenLocation: ('body' | 'uri'),
    pool: Array<Response>
  ): TokenReplacements {
    // Turn the subject into a string.
    const regexpSubject = tokenLocation === 'body'
      ? JSON.stringify(subrequest[tokenLocation])
      : subrequest[tokenLocation];
    // First find all the replacements to do. Use a regular expression to detect
    // cases like "…{{req1.body@$.data.attributes.seasons..id}}…"
    return _.uniqBy(this._findTokens(regexpSubject), '0')
      // Then calculate the replacements we will need to return.
      .reduce((tokenReplacements: TokenReplacements, match: [string, string, string]) => {
        // Remove the .body part at the end since we only support the body
        // replacement at this moment.
        const providedId = match[1].replace(/\.body$/, '');
        // Calculate what are the subjects to execute the JSONPath against.
        const subjects = pool.filter((response) => {
          const contentId = this._getContentId(response).replace(/#.*/, '');
          // The response is considered a subject if it matches the content ID
          // or it is a generated copy based of that content ID.
          return contentId === providedId;
        });
        if (subjects.length === 0) {
          const candidates = pool.map(r => this._getContentId(r).replace(/#.*/, ''));
          throw new Error(`Unable to find specified request for a replacement ${providedId}. Candidates are [${candidates.join(', ')}].`);
        }
        // Find the replacements for this match given a subject.
        subjects.forEach(subject => this._addReplacementsForSubject(
          match,
          subject,
          providedId,
          tokenReplacements
        ));

        return tokenReplacements;
      }, {});
  }

  /**
   * Fill replacement values for a subrequest a subject and an structured token.
   *
   * @param {[string, string, string]} match
   *   The structured replacement token.
   * @param {Response} subject
   *   The response object the token refers to.
   * @param {string} providedId
   *   The Content ID without the # variations.
   * @param {TokenReplacements} tokenReplacements
   *   The accumulated replacements.
   *
   * @return {void}
   *
   * @private
   */
  static _addReplacementsForSubject(
    match: [string, string, string],
    subject: Response,
    providedId: string,
    tokenReplacements: TokenReplacements
  ): void {
    // jsonpath.query always returns an array of matches.
    const toReplace = jsonpath.query(JSON.parse(subject.body), match[2]);
    const token = match[0];
    // The replacements need to be strings. If not, then the replacement
    // is not valid.
    this._validateJsonPathReplacements(toReplace);
    tokenReplacements[providedId] = tokenReplacements[providedId] || {};
    tokenReplacements[providedId][token] = tokenReplacements[providedId][token] || [];
    tokenReplacements[providedId][token] = tokenReplacements[providedId][token].concat(toReplace);
  }

  /**
   * Finds and parses all the tokens in a given string.
   *
   * @param {string} subject
   *   The tokenized string. This is usually the URI or the serialized body.
   *
   * @returns {Array}
   *   A list of all the matches. Each match contains the token, the subject to
   *   search replacements in and the JSONPath query to execute.
   *
   * @private
   */
  static _findTokens(subject: string): Array<[string, string, string]> {
    const regexp = new RegExp('\\{\\{\([^\\{\\{]*\)@\([^\\{\\{]*\)\\}\\}', 'gmu'); // eslint-disable-line no-useless-escape
    const matches = [];
    let match = regexp.exec(subject);
    while (match) {
      // We only care about the first three items: full match, subject ID and
      // JSONPath query.
      matches.push(match.slice(0, 3));
      match = regexp.exec(subject);
    }
    return matches;
  }

  /**
   * Validates tha the JSONPath query yields a string or an array of strings.
   *
   * @param {Array} toReplace
   *   The replacement candidates.
   *
   * @throws
   *   When the replacements are not valid.
   *
   * @returns {void}
   *
   * @private
   */
  static _validateJsonPathReplacements(toReplace: Array<*>): void {
    // Check that all the elements in the array are strings.
    const isValid = Array.isArray(toReplace)
      && toReplace.reduce((valid, item) =>
        valid && (
          typeof item === 'string' ||
          item instanceof String ||
          typeof item === 'number' ||
          item instanceof Number
        ), true);
    if (!isValid) {
      throw new Error(`The replacement token did not a list of strings. Instead it found  ${JSON.stringify(toReplace)}.`);
    }
  }

  /**
   * Gets the clean Content ID for a response.
   *
   * Removes all the derived indicators and the surrounding angles.
   *
   * @param {Response} response
   *   The response to extract the Content ID from.
   *
   * @returns {string}
   *   The content ID.
   *
   * @private
   */
  static _getContentId(response: Response): string {
    return (response.headers.get('Content-ID') || '').slice(1, -1);
  }
};
