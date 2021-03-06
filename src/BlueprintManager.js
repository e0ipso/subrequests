// @flow

import type { Subrequest, SubrequestsTree } from '../types/BlueprintManager';

const _ = require('lodash');
const Ajv = require('ajv');
const uuid = require('uuid').v4;
const blueprintSchema = require('../schema.json');

// Compile the schema in the global scope so we can avoid multiple computations.
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(blueprintSchema);

/**
 * @classdesc
 *   The BlueprintManager parses a tree of requests and validates it.
 *
 * @class BlueprintManager
 */
module.exports = class BlueprintManager {
  /**
   * Parses the input data and produces a blueprint tree.
   *
   * @param {string} text
   *   The text received in the request.
   *
   * @throws {Error}
   *   Throws an error when the user input is not valid.
   *
   * @return {Object[]}
   *   The linked list
   */
  static parse(text: string): SubrequestsTree {
    const input = JSON.parse(text);
    this.validateInput(input);
    const parsed: Array<Subrequest> = input.map(this.fillDefaults);

    return this.isValidTree(parsed)
      // Find the execution sequences.
      ? this.buildExecutionSequence(parsed)
      : [];
  }

  /**
   * Fill the defaults.
   *
   * @param {Object} rawItem
   *   The object to turn into a Subrequest.
   *
   * @return {Subrequest}
   *   The complete Subrequest.
   */
  static fillDefaults(rawItem: Object): Subrequest {
    rawItem.requestId = rawItem.requestId || uuid();
    if (typeof rawItem.body !== 'undefined') {
      rawItem.body = JSON.parse(rawItem.body);
    }
    const headersObject = rawItem.headers || {};
    rawItem.headers = Object.keys(headersObject).reduce((carry, key) => {
      carry.set(key, headersObject[key]);
      return carry;
    }, new Map());
    rawItem.waitFor = rawItem.waitFor || ['<ROOT>'];
    rawItem._resolved = false;
    // Detect if there is an encoded token. If so, then decode the URI.
    if (
      rawItem.uri
      && rawItem.uri.indexOf('%7B%7B') !== -1
      && rawItem.uri.indexOf('%7D%7D') !== -1
    ) {
      rawItem.uri = decodeURIComponent(rawItem.uri);
    }

    return rawItem;
  }

  /**
   * Builds the execution sequence.
   *
   * Builds an array where each position contains the IDs of the requests to be
   * executed. All the IDs in the same position in the sequence can be executed
   * in parallel.
   *
   * @param {Subrequest[]} parsed
   *   The parsed requests.
   *
   * @return {SubrequestsTree}
   *   The sequence of IDs grouped by execution order.
   */
  static buildExecutionSequence(parsed: Array<Subrequest>): SubrequestsTree {
    const sequence: SubrequestsTree = [
      parsed.filter(({ waitFor }) => _.difference(waitFor, ['<ROOT>']).length === 0),
    ];
    let subreqsWithUnresolvedDeps = parsed
      .filter(({ waitFor }) => _.difference(waitFor, ['<ROOT>']).length !== 0);
    // Checks if a subrequest has its dependency resolved.
    // const dependencyIsResolved = ({ waitFor }) => sequence[sequencePosition]
    //   .some(({ requestId }) => requestId === waitFor);
    const dependencyIsResolved = ({ waitFor }, seq) => _.difference(
      waitFor,
      this._allSubrequestIds(seq)
    ).length === 0;
    while (subreqsWithUnresolvedDeps && subreqsWithUnresolvedDeps.length) {
      const noDeps = subreqsWithUnresolvedDeps.filter(sub => dependencyIsResolved(sub, sequence));
      if (noDeps.length === 0) {
        throw new Error('Waiting for unresolvable request. Abort.');
      }
      sequence.push(noDeps);
      subreqsWithUnresolvedDeps = _.difference(subreqsWithUnresolvedDeps, noDeps);
    }
    return sequence;
  }

  /**
   * Calculates all the subrequest IDs present in a tree.
   *
   * @param {SubrequestsTree} sequence
   *   The subrequests in the tree.
   *
   * @return {string[]}
   *   The list of subrequest IDs.
   *
   * @private
   */
  static _allSubrequestIds(sequence: SubrequestsTree): Array<string> {
    const output = new Set(['<ROOT>']);
    sequence.forEach(subrequests => subrequests
      .forEach(subrequest => output.add(subrequest.requestId)));
    return Array.from(output);
  }

  /**
   * Validates the user input.
   *
   * @param {Object[]} parsed
   *   The collection of input subrequests to validate.
   *
   * @throws {Error}
   *   Throws an error if the input is not valid.
   *
   * @return {void}
   */
  static validateInput(parsed: Array<Object>): void {
    const valid = validate(parsed);
    if (!valid) {
      const errors = JSON.stringify(validate.errors, null, 2);
      throw new Error(`The provided blueprint is not valid: ${errors}.`);
    }
  }

  /**
   * Validates the tree.
   *
   * @param {Subrequest[]} parsed
   *   The collection of input subrequests to validate.
   *
   * @return {boolean}
   *   True if the collection is valid. False otherwise.
   */
  static isValidTree(parsed: Array<Subrequest>): boolean {
    // Even if the type says this is a valid tree we need to make sure the user
    // input is correct.
    const isValidItem = (item: Subrequest): boolean => ([
      'requestId',
      'waitFor',
      'uri',
      'action',
      'headers',
    ].reduce((all, key) => all
    && (typeof item[key] !== 'undefined')
    && typeof item.requestId === 'string'
    && Array.isArray(item.waitFor)
    && typeof item.uri === 'string'
    && typeof item.headers === 'object'
    && (typeof item.body === 'undefined' || typeof item.body === 'object')
    && ['view', 'create', 'update', 'replace', 'delete', 'exists', 'discover']
      .indexOf(item.action) !== -1, true));
    return parsed.reduce((valid, rawItem) => valid && isValidItem(rawItem), true);
  }
};
