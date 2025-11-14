<template>
  <TooltipButton tooltip="Clone" icon="mdi-content-copy" variant="elevated" @click="onClick" />
</template>

<script setup lang="ts">
export interface Props {
  name: string;
  builtinList?: string;
}
const props = defineProps<Props>();

const router = useRouter();

const queryObject = computed(() => {
  return Object.assign(props.builtinList ? { builtinList: props.builtinList } : {}, {
    clone: 1,
    name: props.name,
  });
});

const onClick = () => {
  router.push({ path: "/decks/builder", query: queryObject.value });
};
</script>
