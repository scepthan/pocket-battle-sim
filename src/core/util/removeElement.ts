export const removeElement = <T>(arr: T[], element: T): T => {
  const index = arr.indexOf(element);
  if (index > -1) {
    return arr.splice(index, 1)[0];
  }
  throw new Error("Element not found in array");
};
