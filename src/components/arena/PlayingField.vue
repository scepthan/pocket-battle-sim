<template>
  <v-container fluid style="width: 1440px">
    <div class="d-flex ga-4">
      <div class="d-flex" style="width: 882px; height: 704px">
        <div class="d-flex w-100 justify-center flex-row">
          <div class="d-flex flex-column align-center ga-2">
            <PlayerPokemon
              :active="game?.opponentActive"
              :bench="game?.opponentBench ?? []"
              reverse
            />

            <PlayerPokemon :active="game?.selfActive" :bench="game?.selfBench ?? []" />
          </div>

          <div class="h-100 d-flex flex-column align-center justify-space-between">
            <div class="d-flex flex-row align-start">
              <div class="d-flex flex-column align-center ga-2" style="width: 180px">
                <span>{{ game?.opponentName }}</span>
                <EnergyZone
                  class="ml-5"
                  :current-energy="game?.opponentAvailableEnergy"
                  :next-energy="game?.opponentNextEnergy"
                />
                <div class="d-flex flex-row ga-2">
                  <PlayerDeck
                    :deck="game?.opponentUnseenCards ?? []"
                    :hand-size="game?.opponentHandSize"
                  />
                  <PlayerDiscard :cards="game?.selfDiscard.slice().reverse() ?? []" />
                </div>
              </div>
              <PlayerHandHidden :cards="game?.opponentHandSize ?? 0" />
            </div>

            <div class="flex-grow-1 w-100 d-flex flex-column-reverse overflow-y-auto">
              <GameLog :game-log="log" :shown-players="game ? [game.selfName] : []" />
            </div>

            <div class="d-flex flex-row align-end">
              <div class="d-flex flex-column align-center ga-2" style="width: 180px">
                <div class="d-flex flex-row ga-2">
                  <PlayerDeck :deck="game?.selfDeck.slice() ?? []" />
                  <PlayerDiscard :cards="game?.selfDiscard.slice().reverse() ?? []" />
                </div>
                <EnergyZone
                  class="ml-5"
                  :current-energy="game?.selfAvailableEnergy"
                  :next-energy="game?.selfNextEnergy"
                />
                <span>{{ game?.selfName }}</span>
              </div>
              <PlayerHandVisible :cards="game?.selfHand ?? []" />
            </div>
          </div>
        </div>
      </div>
      <div class="d-flex align-end" style="width: 500px">
        <PlayerControls v-if="game" :game="game" player="Player" />
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { GameLogger, PlayerGameView } from "@/core";

export interface Props {
  game?: PlayerGameView;
  log?: GameLogger;
}
defineProps<Props>();
</script>
