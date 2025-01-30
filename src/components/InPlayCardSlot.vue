<template>
  <div v-if="card" class="stacked" :style="style">
    <PlayingCard :card="card.BaseCard" :height-px="heightPx" />

    <div class="card-hp d-flex flex-column align-end">
      {{ Math.floor(card.BaseHP) }}
      <div
        class="stacked"
        :style="{
          width: '25%',
          height: '4%',
          marginTop: '-5%',
        }"
      >
        <div
          class="d-flex flex-row"
          :style="{
            width: 'calc(100% - 3px)',
            height: 'calc(100% - 3px)',
            marginTop: '1.5px',
            marginLeft: '1.5px',
          }"
        >
          <div
            :style="{
              width: hpPercent + '%',
              backgroundColor: '#2F0',
            }"
          />
          <div
            :style="{
              width: 100 - hpPercent + '%',
              backgroundColor: '#333',
            }"
          />
        </div>

        <div
          :style="{
            border: '2px solid #333',
            borderRadius: '4px',
          }"
        ></div>
      </div>
    </div>
  </div>

  <div
    v-else
    :style="{ ...style, border: '2px solid #333a', borderRadius: '4px' }"
  ></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { InPlayPokemonCard } from "@/models/InPlayPokemonCard";
import PlayingCard from "./PlayingCard.vue";

export interface Props {
  heightPx?: number;
  card?: InPlayPokemonCard;
}
const props = defineProps<Props>();

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const hpPercent = computed(() =>
  props.card && "BaseCard" in props.card
    ? (props.card.CurrentHP / props.card.BaseHP) * 100
    : 0
);

const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
  fontSize: height.value / 8 + "px",
}));
</script>

<style scoped>
.stacked {
  display: grid;
}
.stacked * {
  grid-row: 1;
  grid-column: 1;
}
.card-hp {
  text-align: right;
  margin-top: -6%;
  user-select: none;
  z-index: 100;

  font-weight: bold;
  color: black;
  text-shadow: 0 0.07em 0.04em white, 0.07em 0.07em 0.04em white,
    0.07em 0 0.04em white, 0.07em -0.07em 0.04em white, 0 -0.07em 0.04em white,
    -0.07em -0.07em 0.04em white, -0.07em 0 0.04em white,
    -0.07em 0.07em 0.04em white;
}
</style>
