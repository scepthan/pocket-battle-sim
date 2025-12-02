<template>
  <v-container fluid style="width: 1440px">
    <div class="d-flex ga-4">
      <div class="d-flex" style="width: 882px; height: 704px">
        <div class="d-flex w-100 justify-center flex-row">
          <div class="d-flex flex-column align-center ga-2">
            <PlayerPokemon
              :active="gameView?.opponentActive"
              :bench="gameView?.opponentBench ?? []"
              reverse
            />

            <PlayerPokemon
              v-if="gameView?.currentTurnNumber === 0 && pokemonSetup.active"
              :active="pokemonSetup.active"
              :bench="pokemonSetup.bench"
            />
            <PlayerPokemon
              v-else
              :active="gameView?.selfActive"
              :bench="gameView?.selfBench ?? []"
            />
          </div>

          <div class="h-100 d-flex flex-column align-center justify-space-between">
            <div class="d-flex flex-row align-start">
              <div class="d-flex flex-column align-center ga-2" style="width: 180px">
                <span>{{ gameView?.opponentName }}</span>
                <EnergyZone
                  class="ml-5"
                  :current-energy="gameView?.opponentAvailableEnergy"
                  :next-energy="gameView?.opponentNextEnergy"
                />
                <div class="d-flex flex-row ga-2">
                  <PlayerDeck
                    :deck="gameView?.opponentUnseenCards ?? []"
                    :hand-size="gameView?.opponentHandSize"
                  />
                  <PlayerDiscard :cards="gameView?.opponentDiscard.slice().reverse() ?? []" />
                </div>
              </div>
              <PlayerHandHidden :cards="gameView?.opponentHandSize ?? 0" />
            </div>

            <div class="flex-grow-1 w-100 d-flex flex-column-reverse overflow-y-auto">
              <GameLog :game-log="log" :shown-players="gameView ? [gameView.selfName] : []" />
            </div>

            <div class="d-flex flex-row align-end">
              <div class="d-flex flex-column align-center ga-2" style="width: 180px">
                <div class="d-flex flex-row ga-2">
                  <PlayerDeck :deck="gameView?.selfDeck.slice() ?? []" />
                  <PlayerDiscard :cards="gameView?.selfDiscard.slice().reverse() ?? []" />
                </div>
                <EnergyZone
                  class="ml-5"
                  :current-energy="gameView?.selfAvailableEnergy"
                  :next-energy="gameView?.selfNextEnergy"
                />
                <span>{{ gameView?.selfName }}</span>
              </div>
              <PlayerHandVisible :cards="selfHand" />
            </div>
          </div>
        </div>
      </div>
      <div class="d-flex align-end" style="width: 500px">
        <PlayerControls
          v-if="gameView"
          v-model:agent="agent"
          v-model:setup="pokemonSetup"
          :game="gameView"
          player="Player"
        />
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { GameLogger, PlayerAgent, PlayerGameView, removeElement, type PokemonCard } from "@/core";

export interface Props {
  gameView?: PlayerGameView;
  log?: GameLogger;
}
const props = defineProps<Props>();

const agent = defineModel<PlayerAgent>("agent");
const pokemonSetup = ref<{ active?: PokemonCard; bench: PokemonCard[] }>({
  active: undefined,
  bench: [],
});

const selfHand = computed(() => {
  const hand = props.gameView?.selfHand ?? [];

  if (pokemonSetup.value.active) {
    removeElement(hand, pokemonSetup.value.active);
  }
  for (const benched of pokemonSetup.value.bench) {
    removeElement(hand, benched);
  }

  return hand;
});
</script>
