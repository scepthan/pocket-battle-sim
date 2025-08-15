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
        <b>{{ entry.player }}</b> draws <CountDisplay :count="entry.cardIds" single="card" /> to
        their

        <span v-if="entry.cardIds.length === 0">
          hand ({{
            entry.failureReason == "deckEmpty"
              ? "deck is empty"
              : entry.failureReason == "handFull"
              ? "hand is full"
              : entry.failureReason == "noValidCards"
              ? "no valid cards in deck"
              : "unknown reason"
          }}).
        </span>
        <span v-else-if="shownPlayers.includes(entry.player)">
          hand: <CardNameList :card-ids="entry.cardIds" />.
        </span>
        <span v-else> hand. </span>
      </p>

      <div v-else-if="entry.type == 'playToActive'">
        <p>
          <b>{{ entry.player }}</b> chooses <CardName :card-id="entry.cardId" /> as their Active
          Pokemon!
        </p>
      </div>

      <div v-else-if="entry.type == 'playToBench'">
        <p>
          <b>{{ entry.player }}</b> plays <CardName :card-id="entry.cardId" /> to their Bench!
        </p>
      </div>

      <div v-else-if="entry.type == 'evolvePokemon'">
        <p>
          <b>{{ entry.player }}</b> evolves <CardName :card-id="entry.fromPokemon.cardId" /> into
          <CardName :card-id="entry.cardId" />!
        </p>
      </div>

      <div v-else-if="entry.type == 'attachEnergy'">
        <p>
          <span v-if="entry.from == 'pokemon'">
            Energy transferred from
            <CardName :card-id="entry.fromPokemon!.cardId" /> to
            <CardName :card-id="entry.targetPokemon.cardId" />:
          </span>
          <span v-else-if="entry.from == 'player'">
            <b>{{ entry.player }}</b> attaches energy to
            <CardName :card-id="entry.targetPokemon.cardId" />:
          </span>
          <span v-else>
            Energy attached to
            <CardName :card-id="entry.targetPokemon.cardId" />:
          </span>
          <EnergyIcon v-for="(energy, i) in entry.energyTypes" :key="i" :energy="energy" />
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
        <p v-else-if="entry.energyTypes.length > 0">
          Energy discarded:
          <EnergyIcon v-for="(energy, i) in entry.energyTypes" :key="i" :energy="energy" />
        </p>
        <p v-else>No energy could be discarded.</p>
      </div>

      <div v-else-if="entry.type == 'applyPlayerStatus'">
        <p v-if="entry.status.type == 'DecreaseRetreatCost'">
          Retreat cost is {{ entry.status.amount }} less<span
            v-if="entry.status.source == 'Effect'"
          >
            for this turn</span
          >!
        </p>
        <p v-else-if="entry.status.type == 'IncreaseAttack'">
          Attacks used<span v-if="entry.status.descriptor"> by {{ entry.status.descriptor }}</span
          ><span v-if="entry.status.source == 'Effect'"> this turn</span> do +{{
            entry.status.amount
          }}
          damage to the opponent's Active Pokemon!
        </p>
        <p v-else-if="entry.status.type == 'IncreaseDefense'">
          Attacks used<span v-if="entry.status.source == 'Effect'"> next turn</span> do -{{
            entry.status.amount
          }}
          damage to <b>{{ entry.player }}</b
          >'s {{ entry.status.descriptor ?? "Pokemon" }}!
        </p>
        <p v-else-if="entry.status.type == 'CannotUseSupporter'">
          <b>{{ entry.player }}</b> cannot use Supporter cards from their hand<span
            v-if="entry.status.source == 'Effect'"
          >
            next turn</span
          >!
        </p>
        <p v-else>Unknown player status: {{ entry.status.type }}</p>
      </div>

      <div v-else-if="entry.type == 'swapActivePokemon'">
        <p v-if="entry.reason == 'retreat'">
          <b>{{ entry.player }}</b> retreats their active
          <CardName :card-id="entry.fromPokemon.cardId" /> and puts in
          <CardName :card-id="entry.toPokemon.cardId" />!
        </p>
        <p v-else-if="entry.choosingPlayer && entry.choosingPlayer != entry.player">
          <b>{{ entry.choosingPlayer }}</b> switches <b>{{ entry.player }}</b
          >'s active Pokemon to <CardName :card-id="entry.toPokemon.cardId" />!
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

      <div v-else-if="entry.type == 'useAttack' || entry.type == 'copyAttack'">
        <p>
          <CardName :card-id="entry.attackingPokemon.cardId" />
          {{ entry.type == "copyAttack" ? "copies" : "uses" }}
          <b>{{ entry.attackName }}</b
          >!
        </p>
      </div>

      <div v-else-if="entry.type == 'useAbility'">
        <p>
          <CardName :card-id="entry.abilityPokemon.cardId" /> uses <b>{{ entry.abilityName }}</b
          >!
        </p>
      </div>

      <div v-else-if="entry.type == 'triggerAbility'">
        <p>
          <CardName :card-id="entry.abilityPokemon.cardId" />'s <b>{{ entry.abilityName }}</b> is
          activated!
        </p>
      </div>

      <div v-else-if="entry.type == 'coinFlip'">
        <p>Flipping a coin... {{ entry.result }}!</p>
      </div>

      <div v-else-if="entry.type == 'coinMultiFlip'">
        <p>
          Flipping {{ entry.flips }} {{ entry.flips == 1 ? "coin" : "coins" }}...
          <span v-for="(result, i) in entry.results" :key="i"> {{ result }}! </span>
          (Total: {{ entry.results.filter((x) => x == "Heads").length }} heads)
        </p>
      </div>

      <div v-else-if="entry.type == 'coinFlipUntilTails'">
        <p>
          Flipping until tails...
          <span v-for="(result, i) in entry.results" :key="i"> {{ result }}! </span>
          (Total: {{ entry.results.filter((x) => x == "Heads").length }} heads)
        </p>
      </div>

      <div v-else-if="entry.type == 'damagePrevented'">
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> prevented damage and effects of the
          attack!
        </p>
      </div>

      <div v-else-if="entry.type == 'attackFailed'">
        <p>The attack did nothing...</p>
      </div>

      <div v-else-if="entry.type == 'pokemonHealed'">
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> is healed for
          {{ entry.healingDealt }} damage! ({{ entry.initialHP }}/{{ entry.maxHP }} &rarr;
          {{ entry.finalHP }}/{{ entry.maxHP }}
          HP)
        </p>
      </div>

      <div v-else-if="entry.type == 'pokemonDamaged'">
        <p v-if="entry.weaknessBoost">It's super effective!</p>
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> is hit for
          {{ entry.damageDealt }} damage! ({{ entry.initialHP }}/{{ entry.maxHP }} &rarr;
          {{ entry.finalHP }}/{{ entry.maxHP }}
          HP)
        </p>
      </div>

      <div v-else-if="entry.type == 'specialConditionApplied'">
        <p v-for="(condition, i) in entry.specialConditions" :key="i">
          <CardName :card-id="entry.targetPokemon.cardId" /> is now {{ condition }}!
        </p>
        <p v-if="entry.currentConditionList.length > entry.specialConditions.length">
          Current special conditions: {{ entry.currentConditionList.join(", ") }}.
        </p>
      </div>

      <div v-else-if="entry.type == 'specialConditionDamage'">
        <p>
          <CardName :card-id="entry.targetPokemon.cardId" /> takes {{ entry.damageDealt }} damage
          from being {{ entry.specialCondition }}! ({{ entry.initialHP }}/{{ entry.maxHP }} &rarr;
          {{ entry.finalHP }}/{{ entry.maxHP }}
          HP)
        </p>
      </div>

      <div v-else-if="entry.type == 'specialConditionEffective'">
        <CardName :card-id="entry.targetPokemon.cardId" /> is {{ entry.specialCondition }} and
        cannot move!
      </div>

      <div v-else-if="entry.type == 'specialConditionEnded'">
        <p v-for="(condition, i) in entry.specialConditions" :key="i">
          <CardName :card-id="entry.targetPokemon.cardId" /> recovered from being {{ condition }}!
        </p>
        <p v-if="entry.currentConditionList.length > 0">
          Remaining special conditions: {{ entry.currentConditionList.join(", ") }}.
        </p>
      </div>

      <div v-else-if="entry.type == 'applyPokemonStatus'">
        <p v-if="entry.status.type == 'ReduceDamage'">
          <CardName :card-id="entry.targetPokemon.cardId" /> will take &minus;{{
            entry.status.amount
          }}
          damage from attacks<span v-if="entry.status.source == 'Effect'"> next turn</span>!
        </p>
        <p v-else-if="entry.status.type == 'PreventDamage'">
          <CardName :card-id="entry.targetPokemon.cardId" /> cannot be affected by attacks next
          turn!
        </p>
        <p v-else-if="entry.status.type == 'ReduceAttack'">
          <CardName :card-id="entry.targetPokemon.cardId" /> will attack for &minus;{{
            entry.status.amount
          }}
          damage<span v-if="entry.status.source == 'Effect'"> next turn</span>!
        </p>
        <p v-else-if="entry.status.type == 'CannotAttack'">
          <CardName :card-id="entry.targetPokemon.cardId" />
          cannot attack<span v-if="entry.status.source == 'Effect'"> next turn</span>!
        </p>
        <p v-else-if="entry.status.type == 'CannotRetreat'">
          <CardName :card-id="entry.targetPokemon.cardId" />
          cannot retreat<span v-if="entry.status.source == 'Effect'"> next turn</span>!
        </p>
        <p v-else>
          Unknown status type applied to <CardName :card-id="entry.targetPokemon.cardId" />:
          {{ entry.status.type }}
        </p>
      </div>

      <div v-else-if="entry.type == 'pokemonKnockedOut'">
        <p><CardName :card-id="entry.targetPokemon.cardId" /> is knocked out!</p>
      </div>

      <div v-else-if="entry.type == 'scorePrizePoints'">
        <p>
          <b>{{ entry.player }}</b> scores
          <CountDisplay :count="entry.prizePointsScored" single="prize point" />! (Total:
          {{ entry.totalPrizePoints }})
        </p>
      </div>

      <div v-else-if="entry.type == 'discardCards'">
        <p v-if="entry.source == 'inPlay' || entry.source == 'hand'">
          <CountDisplay :count="entry.cardIds" single="card" /> discarded:
          <CardNameList :card-ids="entry.cardIds" />.
        </p>
        <p v-else>
          <b>{{ entry.player }}</b> discards
          <CountDisplay :count="entry.cardIds" single="card" /> from their {{ entry.source }}!
        </p>
      </div>

      <div v-else-if="entry.type == 'returnToHand' || entry.type == 'returnToDeck'">
        <p>
          <CountDisplay :count="entry.cardIds" single="card" /> returned to <b>{{ entry.player }}</b
          >'s {{ entry.type == "returnToHand" ? "hand" : "deck"
          }}<span v-if="entry.source == 'inPlay' || shownPlayers.includes(entry.player)"
            >: <CardNameList :card-ids="entry.cardIds" /> </span
          >.
        </p>
      </div>

      <div v-else-if="entry.type == 'shuffleDeck'">
        <p>
          <b>{{ entry.player }}</b> shuffles their deck.
        </p>
      </div>

      <div v-else-if="entry.type == 'viewCards'">
        <p>
          <b>{{ entry.player }}</b> is viewing
          <CountDisplay :count="entry.cardIds" single="card" /><span
            v-if="shownPlayers.includes(entry.player)"
            >: <CardNameList :card-ids="entry.cardIds" /> </span
          >.
        </p>
      </div>

      <div v-else-if="entry.type == 'selectActivePokemon'">
        <p>
          <b>{{ entry.player }}</b> chooses <CardName :card-id="entry.toPokemon.cardId" /> as their
          next Active Pokemon!
        </p>
      </div>

      <h5 v-else-if="entry.type == 'pokemonCheckup'">Pokemon Checkup phase</h5>

      <div v-else-if="entry.type == 'gameOver'">
        <p v-if="entry.winner">
          Game over: <b>{{ entry.winner }}</b> is victorious! ({{ entry.reason }})
        </p>
        <p v-else>Game over: draw... ({{ entry.reason }})</p>
      </div>

      <div v-else-if="entry.type == 'actionFailed'">
        <p v-if="entry.reason == 'partiallyImplemented'">
          An effect of this attack was not triggered... (Not implemented)
        </p>
        <p v-else>
          But it fails! ({{
            entry.reason == "notImplemented"
              ? "Effect not implemented"
              : entry.reason == "noBenchedPokemon"
              ? "Player has no benched Pokemon"
              : entry.reason == "benchFull"
              ? "Player's bench is full"
              : entry.reason == "noValidTargets"
              ? "Effect has no valid targets"
              : entry.reason == "noValidCards"
              ? "No valid cards"
              : "Unknown reason"
          }})
        </p>
      </div>

      <p v-else>{{ entry }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import CardName from "@/components/common/CardName.vue";
import CardNameList from "@/components/common/CardNameList.vue";
import CountDisplay from "@/components/common/CountDisplay.vue";
import EnergyIcon from "@/components/common/EnergyIcon.vue";
import type { LoggedEvent } from "@/core";

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
