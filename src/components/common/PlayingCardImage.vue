<template>
  <img :src="cardURL" />
</template>

<script setup lang="ts">
import cardBackUrl from "@/assets/img/cardback.jpg";

export interface Props {
  cardUrl?: string;
  widthPx?: number;
}

const props = defineProps<Props>();

const cardURL = computed(() => {
  if (!props.cardUrl) return cardBackUrl;

  const url = `https://assets.pokemon-zone.com/game-assets/CardPreviews/${props.cardUrl}.webp`;

  if (props.widthPx) return `${url}?width=${Math.round(props.widthPx)}&quality=80`;

  return url;
});
</script>
