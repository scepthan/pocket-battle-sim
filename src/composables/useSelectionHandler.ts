export const useSelectionHandler = <T>() => {
  const options: Ref<T[]> = ref([]);
  const select = (option: T | null | "cancel") => resolver.value(option);
  const resolver: Ref<(option: T | null | "cancel") => void> = ref(() => {});
  const selectionPromise = () =>
    new Promise<T | null | "cancel">((resolve) => {
      resolver.value = resolve;
    });
  const text = ref<string>();
  const addReadyButton = ref<boolean>(false);
  const addCancelButton = ref<boolean>(false);

  return { options, select, selectionPromise, text, addReadyButton, addCancelButton };
};
