export const READY_OPTION = Symbol("ready");
export const CANCEL_OPTION = Symbol("cancel");

export const useSelectionHandler = <T>() => {
  type SelectionOption = T | typeof READY_OPTION | typeof CANCEL_OPTION;

  const options: Ref<T[]> = ref([]);
  const prompt = ref<string>();
  const allowReady = ref<boolean>(false);
  const allowCancel = ref<boolean>(false);

  const reset = () => {
    options.value = [];
    prompt.value = undefined;
    allowReady.value = false;
    allowCancel.value = false;
  };

  const resolver: Ref<(option: SelectionOption) => void> = ref(() => {});
  const select = (option: SelectionOption) => resolver.value(option);
  const selectionPromise = () =>
    new Promise<SelectionOption>((resolve) => {
      resolver.value = resolve;
    });

  return { options, prompt, allowReady, allowCancel, reset, select, selectionPromise };
};

export type SelectionHandler<T> = ReturnType<typeof useSelectionHandler<T>>;
