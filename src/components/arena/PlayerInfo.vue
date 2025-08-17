<template>
  <div class="d-flex flex-row" :class="reverse ? 'align-start' : 'align-end'">
    <div
      class="d-flex flex-column align-center ga-2"
      :class="{ 'flex-column-reverse': reverse }"
      style="width: 180px"
    >
      <div class="d-flex flex-row ga-2">
        <PlayerDeck :cards="player?.Deck.slice() ?? []" />
        <PlayerDiscard :cards="player?.Discard.slice().reverse() ?? []" />
      </div>
      <EnergyZone
        class="ml-5"
        :current-energy="player?.AvailableEnergy"
        :next-energy="player?.NextEnergy"
      />
      <span>{{ player?.Name }}</span>
    </div>
    <PlayerHandVisible v-if="handVisible" :cards="player?.Hand ?? []" />
    <PlayerHandHidden v-else :cards="player?.Hand.length ?? 0" />
  </div>
</template>

<script setup lang="ts">
import type { Player } from "@/core";

export interface Props {
  player: Player | undefined;
  reverse?: boolean;
  handVisible?: boolean;
}

defineProps<Props>();
</script>
