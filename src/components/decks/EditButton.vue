<template>
  <TooltipButton tooltip="Edit" icon="mdi-pencil" variant="elevated" @click="onClick" />
</template>

<script setup lang="ts">
export interface Props {
  deckName: string;
}
const props = defineProps<Props>();

const router = useRouter();

const queryObject = computed(() => ({
  name: props.deckName,
}));

const onClick = async () => {
  await router.push({ path: "/decks/builder", query: queryObject.value });
};
</script>
