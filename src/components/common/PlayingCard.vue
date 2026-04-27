<template>
  <div class="flip-card" :style="style">
    <div class="flip-card-inner">
      <div class="flip-card-front" :class="{ unimplemented }">
        <PlayingCardImage :card-url="cardUrl" :width-px="width" :height="height" />
      </div>
      <div class="flip-card-back">
        <PlayingCardImage :width-px="width" :height="height" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";

export interface Props {
  heightPx?: number;
  card?: PlayingCard | string;
}
const props = defineProps<Props>();
const cardUrl = computed(() => {
  return typeof props.card === "string" ? props.card : props.card?.illustrationUrl;
});
const unimplemented = computed(() => typeof props.card === "object" && !props.card.parseSuccessful);

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
}));
</script>

<style scoped>
.flip-card {
  perspective: 600px;
}
.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.8s;
  transform-style: preserve-3d;
}
.flip-card.flippable:hover .flip-card-inner {
  transform: rotateY(-180deg);
}
.flip-card-front,
.flip-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
}
.flip-card-front {
  background-color: #bbb;
  color: black;
}
.flip-card-back {
  transform: rotateY(180deg);
}
.unimplemented {
  filter: grayscale(100%) brightness(80%);
}
</style>
