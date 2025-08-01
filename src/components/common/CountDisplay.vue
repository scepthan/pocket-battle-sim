<template>{{ count }} {{ count === 1 ? single : (plural ?? single + "s") }}</template>

<script setup lang="ts">
import { computed } from "vue";

export interface Props {
  count: Array<unknown> | number;
  single: string;
  plural?: string;
}
const props = defineProps<Props>();

const count = computed(() => {
  if (typeof props.count === "number") {
    return props.count;
  }
  return props.count.length;
});
</script>
