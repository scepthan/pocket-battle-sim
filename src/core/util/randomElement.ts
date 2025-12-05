import { removeElement } from "./removeElement";

export const randomElement = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error("Cannot take a random element from an empty array");
  if (arr.length === 1) return arr[0]!;
  return arr[(Math.random() * arr.length) | 0]!;
};

export const randomElements = <T>(arr: T[], n: number): T[] => {
  const output: T[] = [];
  const input = arr.slice();
  for (let i = 0; i < n && input.length > 0; i++) {
    const choice = randomElement(input);
    output.push(choice);
    removeElement(input, choice);
  }

  return output;
};
