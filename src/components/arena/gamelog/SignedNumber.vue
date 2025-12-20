<template>
  <span v-if="number < 0">&minus;{{ Math.abs(number) }}</span>
  <span v-else>+{{ number }}</span>
</template>

<script setup lang="ts">
export interface Props {
  number: number;
}
defineProps<Props>();
</script>
