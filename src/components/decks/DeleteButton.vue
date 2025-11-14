<template>
  <TooltipButton tooltip="Delete" icon="mdi-delete" variant="elevated" color="red" />
</template>

<script setup lang="ts">
export interface Props {
  name: string;
}
const props = defineProps<Props>();
</script>
