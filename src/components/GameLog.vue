<template>
  <div class="game-log">
    <div
      v-for="(entry, index) in logEntries"
      :key="index"
      class="mb-1 p-2 rounded border border-secondary"
    >
      <p v-if="entry.type == 'startGame'">
        <b>{{ entry.firstPlayer }}</b> wins the coin flip and will go first!
      </p>

      <div v-else-if="entry.type == 'nextTurn'">
        <h2>Turn {{ entry.turnNumber }}</h2>
        <p>
          <b>{{ entry.attackingPlayer }}</b> is now the attacking player!
        </p>
      </div>

      <p v-else-if="entry.type == 'drawToHand'">
        <b>{{ entry.player }}</b> draws {{ entry.cardIds.length }}
        {{ entry.cardIds.length === 1 ? "card" : "cards" }} to their

        <span v-if="entry.cardIds.length === 0">
          hand ({{
            entry.failureReason == "deckEmpty"
              ? "deck is empty"
              : entry.failureReason == "handFull"
              ? "hand is full"
              : "unknown reason"
          }}).
        </span>
        <span v-else-if="shownPlayers.includes(entry.player)">
          hand:
          <span v-for="(cardId, i) in entry.cardIds" :key="i">
            <CardName :card-id="cardId" />{{
              i + 1 === entry.cardIds.length ? "" : ", "
            }} </span
          >.
        </span>
        <span v-else> hand. </span>
      </p>

      <div v-else-if="entry.type == 'playToActive'">
        <p>
          <b>{{ entry.player }}</b> chooses
          <CardName :card-id="entry.cardId" /> as their Active Pokemon!
        </p>
      </div>

      <div v-else-if="entry.type == 'playToBench'">
        <p>
          <b>{{ entry.player }}</b> plays
          <CardName :card-id="entry.cardId" /> to their Bench!
        </p>
      </div>

      <div v-else-if="entry.type == 'evolvePokemon'">
        <p>
          <b>{{ entry.player }}</b> evolves
          <CardName :card-id="entry.fromPokemon.cardId" /> into
          <CardName :card-id="entry.cardId" />!
        </p>
      </div>

      <div v-else-if="entry.type == 'attachEnergy'">
        <p>
          <EnergyIcon :energy="entry.energyType" /> energy attached to
          <CardName :card-id="entry.targetPokemon.cardId" />!
        </p>
      </div>

      <div v-else-if="entry.type == 'generateNextEnergy'">
        <p v-if="entry.currentEnergy == 'none'">
          Next energy for <b>{{ entry.player }}</b
          >:
          <EnergyIcon :energy="entry.nextEnergy" />
        </p>
        <p v-else>
          Energy generated: <EnergyIcon :energy="entry.currentEnergy" /> (Next:
          <EnergyIcon :energy="entry.nextEnergy" />)
        </p>
      </div>

      <div v-else-if="entry.type == 'discardEnergy'">
        <p v-if="entry.source == 'energyZone'">
          <b>{{ entry.player }}</b> discards an energy from their energy zone:
          <EnergyIcon :energy="entry.energyTypes[0]" />
        </p>
      </div>

      <h5 v-else-if="entry.type == 'pokemonCheckup'">Pokemon Checkup phase</h5>

      <div v-else-if="entry.type == 'gameOver'">
        <p v-if="entry.winner">
          Game over: <b>{{ entry.winner }}</b> wins the game!
          <span v-if="entry.reason"> ({{ entry.reason }}) </span>
        </p>
        <p v-else>Game over: draw... ({{ entry.reason }})</p>
      </div>

      <p v-else>{{ entry }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoggedEvent } from "@/models/GameLogger";
import EnergyIcon from "./EnergyIcon.vue";
import CardName from "./CardName.vue";

export interface Props {
  logEntries: readonly LoggedEvent[];
  shownPlayers: string[];
}
defineProps<Props>();
</script>

<style scoped>
.game-log {
  max-width: 500px;
}
.energy-icon {
  height: 1.25em;
  margin-bottom: -4px;
}
</style>
