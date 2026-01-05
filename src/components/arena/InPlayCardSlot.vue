<template>
  <div v-if="card && !('isPokemon' in card)">
    <PlayingCard :card="card" :height-px="heightPx" />
  </div>
  <div v-else-if="card?.isPokemon" class="stacked" :style="cardStyle">
    <PlayingCard :card="card.ID" :height-px="heightPx" />

    <div class="card-hp d-flex flex-column align-end">
      {{ Math.floor(card.CurrentHP) }}
      <div class="stacked hp-bar-container">
        <div class="hp-bar-inner">
          <div :style="hpBarStyle" />
          <div :style="hpBarPaddingStyle" />
        </div>
        <div class="hp-bar-border" />
      </div>

      <div class="pokemon-tools">
        <PlayingCardImage
          v-for="(tool, i) in card.AttachedToolCards"
          :key="i"
          :card-id="tool.ID"
          :title="tool.Name"
        />
      </div>
    </div>

    <div class="card-energy">
      <EnergyIcon
        v-for="(energy, i) in card.AttachedEnergy"
        :key="i"
        :width="height / 10"
        :energy="energy"
      />
    </div>
  </div>

  <div v-else :style="{ ...cardStyle, border: '2px solid #333a', borderRadius: '4px' }" />
</template>

<script setup lang="ts">
import type { CardSlotView, PokemonCard } from "@/core";

export interface Props {
  heightPx?: number;
  card?: PokemonCard | CardSlotView;
}
const props = defineProps<Props>();

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const hpPercent = computed(() =>
  props.card && "isPokemon" in props.card && props.card.isPokemon
    ? (props.card.CurrentHP / props.card.MaxHP) * 100
    : 0
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

.pokemon-tools {
  width: 30%;
  height: 13.2%;
  overflow: hidden;
  margin-right: -3%;
  margin-top: 5%;
}
.pokemon-tools img {
  width: 110%;
  margin-top: -19%;
  margin-left: -5%;
}
</style>
