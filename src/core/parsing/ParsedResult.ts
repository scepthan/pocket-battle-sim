export type ParsedResult<TResult> = {
  value: TResult;
  parseSuccessful: boolean;
};
export type ParsedResultOptional<TResult> =
  | {
      parseSuccessful: true;
      value: TResult;
    }
  | {
      parseSuccessful: false;
      value: TResult | undefined;
    };
