<template>
  <v-container fluid>
    <div class="d-flex" style="width: 1004px; height: 704px">
      <div class="d-flex w-100 justify-center flex-row">
        <div class="d-flex flex-column align-center ga-2">
          <v-row no-gutters class="align-center ga-1">
            <InPlayCardSlot
              v-for="i in 3"
              :key="i"
              :card="game?.Player2.Bench[i - 1] ?? EmptyCardSlot.Bench(i - 1)"
              :height-px="140"
            />
          </v-row>
          <v-row no-gutters class="align-center">
            <InPlayCardSlot :card="game?.Player2.ActivePokemon ?? EmptyCardSlot.Active()" />
          </v-row>

          <v-row no-gutters class="align-center">
            <InPlayCardSlot :card="game?.Player1.ActivePokemon ?? EmptyCardSlot.Active()" />
          </v-row>
          <v-row no-gutters class="align-center ga-1">
            <InPlayCardSlot
              v-for="i in 3"
              :key="i"
              :card="game?.Player1.Bench[i - 1] ?? EmptyCardSlot.Bench(i - 1)"
              :height-px="140"
            />
          </v-row>
        </div>

        <div class="h-100 d-flex flex-column align-center justify-space-between">
          <div class="d-flex flex-row">
            <div class="d-flex flex-column align-center" style="width: 128px">
              <span>{{ game?.Player2.Name }}</span>
              <EnergyZone
                class="ml-5"
                :current-energy="game?.Player2.AvailableEnergy"
                :next-energy="game?.Player2.NextEnergy"
              />
            </div>
            <PlayerHandHidden :cards="game?.Player2.Hand.length ?? 0" />
          </div>
          <div class="flex-grow-1 w-100 d-flex flex-column-reverse overflow-y-auto">
            <GameLog
              :log-entries="game?.GameLog.entries ?? []"
              :shown-players="shownPlayers ?? []"
            />
          </div>
          <div class="d-flex flex-row align-end">
            <div class="d-flex flex-column align-center" style="width: 128px">
              <EnergyZone
                class="ml-5"
                :current-energy="game?.Player1.AvailableEnergy"
                :next-energy="game?.Player1.NextEnergy"
              />
              <span>{{ game?.Player1.Name }}</span>
            </div>
            <PlayerHandVisible :cards="game?.Player1.Hand ?? []" />
          </div>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import type { Game } from "@/core";
import { EmptyCardSlot } from "@/core/gamelogic/types/EmptyCardSlot";
import EnergyZone from "./EnergyZone.vue";
import GameLog from "./GameLog.vue";
import InPlayCardSlot from "./InPlayCardSlot.vue";
import PlayerHandHidden from "./PlayerHandHidden.vue";
import PlayerHandVisible from "./PlayerHandVisible.vue";

export interface Props {
  game: Game | undefined;
  shownPlayers?: string[];
}
defineProps<Props>();
</script>
