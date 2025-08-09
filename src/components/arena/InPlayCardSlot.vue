<template>
  <div v-if="card?.isPokemon" class="stacked" :style="cardStyle">
    <PlayingCard :card="card.BaseCard" :height-px="heightPx" />

    <div class="card-hp d-flex flex-column align-end">
      {{ Math.floor(card.CurrentHP) }}
      <div class="stacked hp-bar-container">
        <div class="hp-bar-inner">
          <div :style="hpBarStyle" />
          <div :style="hpBarPaddingStyle" />
        </div>
        <div class="hp-bar-border" />
      </div>
    </div>

    <div class="card-energy">
      <EnergyIcon
        v-for="i in card.AttachedEnergy.length"
        :key="i"
        :width="height / 10"
        :energy="card.AttachedEnergy[i - 1]"
      />
    </div>
  </div>

  <div v-else :style="{ ...cardStyle, border: '2px solid #333a', borderRadius: '4px' }" />
</template>

<script setup lang="ts">
import EnergyIcon from "@/components/common/EnergyIcon.vue";
import PlayingCard from "@/components/common/PlayingCard.vue";
import type { EmptyCardSlot, InPlayPokemonCard } from "@/core";
import { computed } from "vue";

export interface Props {
  heightPx?: number;
  card?: InPlayPokemonCard | EmptyCardSlot;
}
const props = defineProps<Props>();

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const hpPercent = computed(() =>
  props.card && "BaseCard" in props.card ? (props.card.CurrentHP / props.card.BaseHP) * 100 : 0
);

const cardStyle = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
  fontSize: height.value / 8 + "px",
}));
const hpBarStyle = computed(() => ({
  width: hpPercent.value + "%",
  backgroundColor: "#2F0", // ideally would change color based on %
}));
const hpBarPaddingStyle = computed(() => ({
  width: 100 - hpPercent.value + "%",
  backgroundColor: "#333",
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
  text-shadow: 0 0.07em 0.04em white, 0.07em 0.07em 0.04em white, 0.07em 0 0.04em white,
    0.07em -0.07em 0.04em white, 0 -0.07em 0.04em white, -0.07em -0.07em 0.04em white,
    -0.07em 0 0.04em white, -0.07em 0.07em 0.04em white;
}

.hp-bar-container {
  width: 25%;
  height: 4%;
  margin-top: -5%;
}
.hp-bar-inner {
  display: flex;
  flex-direction: row;
  width: calc(100% - 3px);
  height: calc(100% - 3px);
  margin-top: 1.5px;
  margin-left: 1.5px;
}
.hp-bar-border {
  border: 2px solid #333;
  border-radius: 4px;
}

.card-energy {
  z-index: 100;
  display: flex;
  align-items: end;
}
.card-energy img {
  margin-right: -8px;
}
</style>
