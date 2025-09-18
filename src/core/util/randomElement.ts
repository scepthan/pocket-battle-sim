export const randomElement = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error("Cannot take a random element from an empty array");
  if (arr.length === 1) return arr[0]!;
  return arr[(Math.random() * arr.length) | 0]!;
};
