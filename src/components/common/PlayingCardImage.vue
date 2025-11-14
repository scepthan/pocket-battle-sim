<template>
  <img :src="cardURL" />
</template>

<script setup lang="ts">
import cardBackUrl from "@/assets/img/cardback.jpg";

export interface Props {
  cardId?: string;
}

const props = defineProps<Props>();

const cardURL = computed(() => {
  if (!props.cardId) return cardBackUrl;

  const cardId = props.cardId.replace("PROMO-A", "PROMO");
  return `https://static.dotgg.gg/pokepocket/card/${cardId}.webp`;
});
</script>
