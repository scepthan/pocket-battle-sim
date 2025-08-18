<template>
  <v-container fluid>
    <div class="d-flex" style="width: 1056px; height: 704px">
      <div class="d-flex w-100 justify-center flex-row">
        <div class="d-flex flex-column align-center ga-2">
          <PlayerPokemon :player="game?.Player2" reverse />

          <PlayerPokemon :player="game?.Player1" />
        </div>

        <div class="h-100 d-flex flex-column align-center justify-space-between">
          <PlayerInfo :player="game?.Player2" reverse />
          <div class="flex-grow-1 w-100 d-flex flex-column-reverse overflow-y-auto">
            <GameLog :game-log="game?.GameLog" :shown-players="shownPlayers ?? []" />
          </div>
          <PlayerInfo :player="game?.Player1" hand-visible />
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { type Game } from "@/core";
import GameLog from "./GameLog.vue";
import PlayerInfo from "./PlayerInfo.vue";
import PlayerPokemon from "./PlayerPokemon.vue";

export interface Props {
  game: Game | undefined;
  shownPlayers?: string[];
}
defineProps<Props>();
</script>
