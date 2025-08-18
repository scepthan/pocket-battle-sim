<template>
  <div class="d-flex flex-row" :class="reverse ? 'align-start' : 'align-end'">
    <div
      class="d-flex flex-column align-center ga-2"
      :class="{ 'flex-column-reverse': reverse }"
      style="width: 180px"
    >
      <div class="d-flex flex-row ga-2">
        <PlayerDeck
          :deck="player?.Deck.slice() ?? []"
          :hand="handVisible ? undefined : player?.Hand.slice() ?? []"
        />
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
import EnergyZone from "./EnergyZone.vue";
import PlayerDeck from "./PlayerDeck.vue";
import PlayerDiscard from "./PlayerDiscard.vue";
import PlayerHandHidden from "./PlayerHandHidden.vue";
import PlayerHandVisible from "./PlayerHandVisible.vue";

export interface Props {
  player: Player | undefined;
  reverse?: boolean;
  handVisible?: boolean;
}

defineProps<Props>();
</script>
