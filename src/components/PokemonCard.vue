<template>
  <img
    :src="`https://static.dotgg.gg/pokepocket/card/${card}.webp`"
    height="200"
  />
</template>

<script setup lang="ts">
export interface Props {
  card: string;
}
defineProps<Props>();
</script>
