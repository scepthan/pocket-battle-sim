<template>
  <div v-if="game && game.isSelfTurn">
    <p>What would you like to do?</p>

    <div class="d-flex flex-wrap ga-2">
      <v-btn :disabled="playableCards.length === 0">Play Card</v-btn>
      <v-btn :disabled="!game.selfAvailableEnergy">Attach Energy</v-btn>
      <v-btn :disabled="usableAbilities.length === 0">Use Ability</v-btn>
      <v-btn :disabled="usableAttacks.length === 0">Attack</v-btn>
      <v-btn :disabled="!game.canRetreat(true)">Retreat</v-btn>
      <v-btn :color="actionsLeft ? 'red' : 'default'">End Turn</v-btn>
    </div>
  </div>
  <div v-else>
    <p>Waiting for opponent...</p>
  </div>
</template>

<script setup lang="ts">
import type { PlayerGameView } from "@/core";

export interface Props {
  game?: PlayerGameView;
}
const props = defineProps<Props>();

const playableCards = computed(
  () => props.game?.selfHand.filter((card) => props.game?.canPlayCard(card, true)) ?? []
);
const usableAbilities = computed(
  () =>
    props.game?.selfInPlayPokemon.filter(
      (pokemon) => pokemon.Ability && props.game?.canUseAbility(pokemon, pokemon.Ability, true)
    ) ?? []
);
const usableAttacks = computed(() =>
  props.game?.selfActive.isPokemon
    ? props.game.selfActive.Attacks.filter((attack) => props.game?.canUseAttack(attack, true)) ?? []
    : []
);

const actionsLeft = computed(
  () =>
    playableCards.value.length > 0 ||
    props.game?.selfAvailableEnergy ||
    usableAbilities.value.length > 0 ||
    usableAttacks.value.length > 0
);
</script>
