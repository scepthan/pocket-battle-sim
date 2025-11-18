export type Sortable = number | string | boolean;

export const sortedBy = <T>(arr: T[], fn: (x: T) => Sortable, sortKey?: Sortable[]): T[] => {
  const sortingArray = arr.map((x) => ({
    value: x,
    sortingValue: sortKey?.indexOf(fn(x)) ?? fn(x),
  }));
  sortingArray.sort((a, b) => {
    return a.sortingValue > b.sortingValue ? 1 : a.sortingValue < b.sortingValue ? -1 : 0;
  });
  return sortingArray.map((x) => x.value);
};
