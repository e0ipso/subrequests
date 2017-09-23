// @flow

export type TokenReplacements = {
  [string]: {
    [string]: Array<string>
  }
};
export type TokenReplacementsTree = Map<string, Map<number, Map<string, string>>>;
export type Point = Array<{
  token: string,
  value: string,
}>;
