export const removeElement = <T>(arr: T[], element: T): T => {
  const index = arr.indexOf(element);
  if (index > -1) {
    arr.splice(index, 1);
    return element;
  }
  throw new Error("Element not found in array");
};
