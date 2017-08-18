// @flow

export type Subrequest = {
  requestId: string,
  waitFor: string,
  uri: string,
  action: ("view" | "create" | "update" | "replace" | "delete" | "exists" | "discover"),
  body?: Object,
  headers: Map<string, string>,
  _resolved: boolean,
};

export type SubrequestsTree = Array<Array<Subrequest>>;
