export const useSelectionHandler = <T>() => {
  const options = ref<T[]>([]);
  const select = (option: T | null | "cancel") => resolver.value(option);
  const resolver = ref<(option: T | null | "cancel") => void>(() => {});
  const selectionPromise = () =>
    new Promise<T | null | "cancel">((resolve) => {
      resolver.value = resolve;
    });
  const text = ref<string>();

  return { options, select, selectionPromise, text };
};
