const disableArtFilter = ref<boolean>(localStorage.getItem("disableArtFilter") === "true");

watch(disableArtFilter, (val) => localStorage.setItem("disableArtFilter", String(val)));

export const useDisableArtFilter = () => {
  return { disableArtFilter };
};
