export const READY_OPTION = Symbol("ready");
export const CANCEL_OPTION = Symbol("cancel");

export const useSelectionHandler = <T>() => {
  type SelectionOption = T | typeof READY_OPTION | typeof CANCEL_OPTION;

  const options: Ref<T[]> = ref([]);
  const text = ref<string>();
  const addReadyButton = ref<boolean>(false);
  const addCancelButton = ref<boolean>(false);

  const reset = () => {
    options.value = [];
    text.value = undefined;
    addReadyButton.value = false;
    addCancelButton.value = false;
  };

  const resolver: Ref<(option: SelectionOption) => void> = ref(() => {});
  const select = (option: SelectionOption) => resolver.value(option);
  const selectionPromise = () =>
    new Promise<SelectionOption>((resolve) => {
      resolver.value = resolve;
    });

  return { options, text, addReadyButton, addCancelButton, reset, select, selectionPromise };
};
