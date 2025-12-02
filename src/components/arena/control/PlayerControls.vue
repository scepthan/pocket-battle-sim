<template>
  <div v-if="stage === 'selectCard'">
    <p>{{ cardSelectText ?? "Select a card:" }}</p>
    <div class="d-flex flex-wrap ga-2">
      <v-btn v-for="(pokemon, i) in availableCards" :key="i" @click="selectCard(pokemon)">{{
        pokemon.Name
      }}</v-btn>
      <v-btn v-if="addReadyButton" color="green" @click="selectCard(null)">Ready</v-btn>
    </div>
  </div>
  <div v-else-if="game?.currentTurnNumber === 0">Waiting to start...</div>
  <div v-else-if="game?.isSelfTurn">
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
import {
  PlayerAgent,
  removeElement,
  type GameInitState,
  type PlayerGameView,
  type PlayingCard,
  type PokemonCard,
} from "@/core";

export interface Props {
  game?: PlayerGameView;
}
const props = defineProps<Props>();
const agent = defineModel<PlayerAgent>("agent");

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

const stage = ref<string>("idle");

const availableCards = ref<PlayingCard[]>([]);
const selectCard = (card: PlayingCard | null) => cardSelectResolver.value(card);
const cardSelectResolver = ref<(card: PlayingCard | null) => void>(() => {});
const cardSelectionPromise = () =>
  new Promise<PlayingCard | null>((resolve) => {
    cardSelectResolver.value = resolve;
  });
const cardSelectText = ref<string>();

const addReadyButton = ref<boolean>(false);

const setupAgent = () => {
  if (!agent.value) return;

  agent.value.setupPokemon = async (gameView: GameInitState) => {
    stage.value = "selectCard";
    cardSelectText.value = "Select your Active Pokémon:";
    availableCards.value = gameView.hand.filter(
      (card) => card.CardType === "Pokemon" && card.Stage === 0
    );
    const active = (await cardSelectionPromise()) as PokemonCard;
    removeElement(availableCards.value, active);

    const bench: PokemonCard[] = [];
    cardSelectText.value = "Select your Benched Pokémon:";
    addReadyButton.value = true;
    while (availableCards.value.length > 0) {
      const selectedPokemon = await cardSelectionPromise();
      if (selectedPokemon === null) break;
      bench.push(selectedPokemon as PokemonCard);
      removeElement(availableCards.value, selectedPokemon);
    }

    stage.value = "idle";
    availableCards.value = [];
    cardSelectText.value = undefined;
    addReadyButton.value = false;

    return { active, bench };
  };
};

onMounted(setupAgent);
watch(agent, setupAgent);
</script>
