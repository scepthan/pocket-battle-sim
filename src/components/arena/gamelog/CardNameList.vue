<template>
  <span v-for="(cardId, i) in cardIds" :key="i">
    <CardName :card-id="cardId" />{{ i + 1 === cardIds.length ? "" : ", " }}
  </span>
</template>

<script setup lang="ts">
export interface Props {
  cardIds: string[];
}
defineProps<Props>();
</script>
