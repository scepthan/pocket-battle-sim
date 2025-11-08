<template>
  <img :src="cardURL" />
</template>

<script setup lang="ts">
import cardBackUrl from "@/assets/img/cardback.jpg";

export interface Props {
  cardId?: string;
}

const props = defineProps<Props>();

const cardURL = computed(() =>
  props.cardId ? `https://static.dotgg.gg/pokepocket/card/${props.cardId}.webp` : cardBackUrl
);
</script>
