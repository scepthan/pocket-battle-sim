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
              : entry.failureReason == "noBasicPokemon"
              ? "no Basic Pokemon in deck"
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
        <p v-else>
          Energy discarded:
          <EnergyIcon
            v-for="(energy, i) in entry.energyTypes"
            :key="i"
            :energy="energy"
          />
        </p>
      </div>

      <div v-else-if="entry.type == 'applyModifier'">
        <p v-if="entry.attribute == 'retreatCost'">
          Retreat cost is now {{ Math.abs(entry.totalModifier) }}
          {{ entry.totalModifier < 0 ? "less" : "more" }} for this turn!
        </p>
        <p v-else-if="entry.attribute == 'activeDamage'">
          Attacks used this turn do +{{ entry.totalModifier }} damage to your
          opponent's active Pokemon!
        </p>
        <p v-else-if="entry.attribute == 'damageReduction'">
          Attacks used next turn do -{{ entry.totalModifier }} damage to your
          Pokemon!
        </p>
        <p v-else>Unknown modifier: {{ entry.attribute }}</p>
      </div>

      <div v-else-if="entry.type == 'swapActivePokemon'">
        <p v-if="entry.reason == 'retreat'">
          <b>{{ entry.player }}</b> retreats their active
          <CardName :card-id="entry.fromPokemon.cardId" /> and puts in
          <CardName :card-id="entry.toPokemon.cardId" />!
        </p>
        <p v-else>
          <b>{{ entry.player }}</b> switches their active Pokemon to
          <CardName :card-id="entry.toPokemon.cardId" />!
        </p>
      </div>

      <div v-else-if="entry.type == 'playTrainer'">
        <p>
          <b>{{ entry.player }}</b> uses <CardName :card-id="entry.cardId" />!
        </p>
      </div>

      <div v-else-if="entry.type == 'useAttack'">
        <p>
          <CardName :card-id="entry.attackingPokemon.cardId" /> uses
          <b>{{ entry.attackName }}</b
          >!
        </p>
      </div>

      <div v-else-if="entry.type == 'coinFlip'">
        <p>Flipping a coin... {{ entry.result }}!</p>
      </div>

      <div v-else-if="entry.type == 'coinMultiFlip'">
        <p>
          Flipping {{ entry.flips }}
          {{ entry.flips == 1 ? "coin" : "coins" }}...
          <span v-for="(result, i) in entry.results" :key="i">
            {{ result }}!
          </span>
          (Total: {{ entry.results.filter((x) => x == "Heads").length }} heads)
        </p>
      </div>

      <div v-else-if="entry.type == 'coinFlipUntilTails'">
        <p>
          Flipping until tails...
          <span v-for="(result, i) in entry.results" :key="i">
            {{ result }}!
          </span>
          (Total: {{ entry.results.filter((x) => x == "Heads").length }} heads)
        </p>
      </div>

      <div v-else-if="entry.type == 'pokemonHealed'">
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> is healed for
          {{ entry.healingDealt }} damage! ({{ entry.initialHP }}/{{
            entry.maxHP
          }}
          &rarr; {{ entry.finalHP }}/{{ entry.maxHP }}
          HP)
        </p>
      </div>

      <div v-else-if="entry.type == 'pokemonDamaged'">
        <p v-if="entry.weaknessBoost">It's super effective!</p>
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> is hit for
          {{ entry.damageDealt }} damage! ({{ entry.initialHP }}/{{
            entry.maxHP
          }}
          &rarr; {{ entry.finalHP }}/{{ entry.maxHP }}
          HP)
        </p>
      </div>

      <div v-else-if="entry.type == 'pokemonKnockedOut'">
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> is knocked out!
        </p>
      </div>

      <div v-else-if="entry.type == 'scorePrizePoints'">
        <p>
          <b>{{ entry.player }}</b> scores {{ entry.prizePointsScored }} prize
          {{ entry.prizePointsScored == 1 ? "point" : "points" }}! (Total:
          {{ entry.totalPrizePoints }})
        </p>
      </div>

      <div v-else-if="entry.type == 'discardCards'">
        <p v-if="entry.source == 'inPlay' || entry.source == 'hand'">
          {{ entry.cardIds.length }}
          {{ entry.cardIds.length == 1 ? "card" : "cards" }} discarded:
          <span v-for="(cardId, i) in entry.cardIds" :key="i">
            <CardName :card-id="cardId" />{{
              i + 1 === entry.cardIds.length ? "" : ", "
            }} </span
          >.
        </p>
        <p v-else>
          <b>{{ entry.player }}</b> discards {{ entry.cardIds.length }}
          {{ entry.cardIds.length === 1 ? "card" : "cards" }} from their
          {{ entry.source }}!
        </p>
      </div>

      <div v-else-if="entry.type == 'selectActivePokemon'">
        <p>
          <b>{{ entry.player }}</b> chooses
          <CardName :card-id="entry.toPokemon.cardId" /> as their next Active
          Pokemon!
        </p>
      </div>

      <h5 v-else-if="entry.type == 'pokemonCheckup'">Pokemon Checkup phase</h5>

      <div v-else-if="entry.type == 'gameOver'">
        <p v-if="entry.winner">
          Game over: <b>{{ entry.winner }}</b> is victorious! ({{
            entry.reason
          }})
        </p>
        <p v-else>Game over: draw... ({{ entry.reason }})</p>
      </div>

      <div v-else-if="entry.type == 'actionFailed'">
        <p v-if="entry.reason == 'partiallyImplemented'">
          An effect of this move was not triggered... (Not implemented)
        </p>
        <p v-else>
          But it fails! ({{
            entry.reason == "notImplemented"
              ? "Effect not implemented"
              : entry.reason == "noBenchedPokemon"
              ? "Player has no benched Pokemon"
              : entry.reason == "noValidTargets"
              ? "effect has no valid targets"
              : "Unknown reason"
          }})
        </p>
      </div>

      <p v-else>{{ entry }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoggedEvent } from "@/models/GameLogger";
import CardName from "./CardName.vue";
import EnergyIcon from "./EnergyIcon.vue";

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
