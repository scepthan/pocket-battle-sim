import { removeElement } from "./removeElement";

export const isSubset = <T>(options: T[], selected: T[]) => {
  const check = options.slice();
  for (const item of selected) {
    if (!check.includes(item)) {
      return false;
    }
    removeElement(check, item);
  }
  return true;
};
