<template>
  <div v-if="gameLog !== undefined" class="game-log">
    <div v-for="(logEntries, turnNumber) in gameLog.turns.slice().reverse()" :key="turnNumber">
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
          <p class="sub-entry">
            <b>{{ entry.attackingPlayer }}</b> is now the attacking player!
          </p>
        </div>

        <p v-else-if="entry.type == 'drawToHand'" class="sub-entry">
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

        <p v-else-if="entry.type == 'putIntoHand'" class="sub-entry">
          <b>{{ entry.player }}</b> puts <CountDisplay :count="entry.cardIds" single="card" /> into
          their hand<span v-if="shownPlayers.includes(entry.player)"
            >: <CardNameList :card-ids="entry.cardIds" /> </span
          >.
        </p>

        <div v-else-if="entry.type == 'playToActive'">
          <p>
            <b>{{ entry.player }}</b> chooses <CardName :card-id="entry.cardId" /> as their Active
            Pokémon!
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

        <div
          v-else-if="entry.type == 'attachEnergy'"
          :class="entry.from === 'turn' ? '' : 'sub-entry'"
        >
          <p>
            <span v-if="entry.from == 'pokemon'">
              Energy transferred from
              <CardName :card-id="entry.fromPokemon!.cardId" /> to
              <CardName :card-id="entry.targetPokemon.cardId" />:
            </span>
            <span v-else-if="entry.from == 'turn'">
              <b>{{ entry.player }}</b> attaches Energy to
              <CardName :card-id="entry.targetPokemon.cardId" />:
            </span>
            <span v-else>
              Energy attached to
              <CardName :card-id="entry.targetPokemon.cardId" />:
            </span>
            <EnergyIcon v-for="(energy, i) in entry.energyTypes" :key="i" inline :energy="energy" />
          </p>
        </div>

        <div v-else-if="entry.type == 'generateNextEnergy'" class="sub-entry">
          <p v-if="entry.currentEnergy == 'none'">
            Next Energy for <b>{{ entry.player }}</b
            >:
            <EnergyIcon inline :energy="entry.nextEnergy" />
          </p>
          <p v-else>
            Energy generated: <EnergyIcon inline :energy="entry.currentEnergy" /> (Next:
            <EnergyIcon inline :energy="entry.nextEnergy" />)
          </p>
        </div>

        <div v-else-if="entry.type == 'changeNextEnergy'" class="sub-entry">
          Next energy for <b>{{ entry.player }}</b> changed to
          <EnergyIcon inline :energy="entry.nextEnergy" />!
        </div>

        <div v-else-if="entry.type == 'discardEnergy'" class="sub-entry">
          <p v-if="entry.energyTypes.length == 0">No Energy could be discarded.</p>
          <p v-else>
            <span v-if="entry.source == 'energyZone'">
              <b>{{ entry.player }}</b> discards an Energy from their Energy Zone:
            </span>
            <span v-else-if="entry.targetPokemon">
              Energy discarded from <CardName :card-id="entry.targetPokemon.cardId" />:
            </span>
            <span v-else> Energy discarded: </span>
            <EnergyIcon v-for="(energy, i) in entry.energyTypes" :key="i" inline :energy="energy" />
          </p>
        </div>

        <div v-else-if="entry.type == 'applyPokemonStatus'" class="sub-entry">
          <PokemonStatusEvent :entry="entry" />
        </div>

        <div v-else-if="entry.type == 'removePokemonStatus'" class="sub-entry">
          <p>
            Status removed from <CardName :card-id="entry.targetPokemon.cardId" />:
            {{ entry.status.type }}
          </p>
        </div>

        <div v-else-if="entry.type == 'applyPlayerStatus'" class="sub-entry">
          <PlayerStatusEvent :entry="entry" />
        </div>

        <div v-else-if="entry.type == 'removePlayerStatus'" class="sub-entry">
          <p>Status removed from {{ entry.player }}: {{ entry.status.type }}</p>
        </div>

        <div
          v-else-if="entry.type == 'swapActivePokemon'"
          :class="entry.reason === 'retreat' ? '' : 'sub-entry'"
        >
          <p v-if="entry.reason == 'retreat'">
            <b>{{ entry.player }}</b> retreats their active
            <CardName :card-id="entry.fromPokemon.cardId" /> and puts in
            <CardName :card-id="entry.toPokemon.cardId" />!
          </p>
          <p v-else-if="entry.choosingPlayer && entry.choosingPlayer != entry.player">
            <b>{{ entry.choosingPlayer }}</b> switches <b>{{ entry.player }}</b
            >'s Active Pokémon to <CardName :card-id="entry.toPokemon.cardId" />!
          </p>
          <p v-else>
            <b>{{ entry.player }}</b> switches their Active Pokémon to
            <CardName :card-id="entry.toPokemon.cardId" />!
          </p>
        </div>

        <div v-else-if="entry.type == 'playTrainer'">
          <p>
            <b>{{ entry.player }}</b> uses <CardName :card-id="entry.cardId" />!
          </p>
        </div>

        <div v-else-if="entry.type == 'copyTrainer'" class="sub-entry">
          <p>
            <CardName v-if="entry.user" :card-id="entry.user.cardId" />
            <b v-else>{{ entry.player }}</b> copies <CardName :card-id="entry.cardId" />!
          </p>
        </div>

        <div v-else-if="entry.type == 'attachPokemonTool'">
          <p>
            <b>{{ entry.player }}</b> attaches <CardName :card-id="entry.cardId" /> to
            <CardName :card-id="entry.targetPokemon.cardId" />!
          </p>
        </div>

        <div v-else-if="entry.type == 'triggerPokemonTool'" class="sub-entry">
          <p><CardName :card-id="entry.cardId" />'s effect is triggered!</p>
        </div>

        <div v-else-if="entry.type == 'removePokemonTool'" class="sub-entry">
          <p>
            <CardName :card-id="entry.cardId" /> is removed from
            <CardName :card-id="entry.targetPokemon.cardId" />!
          </p>
        </div>

        <div v-else-if="entry.type == 'useAttack'">
          <p>
            <CardName :card-id="entry.attackingPokemon.cardId" /> uses <b>{{ entry.attackName }}</b
            >!
          </p>
        </div>

        <div v-else-if="entry.type == 'copyAttack'" class="sub-entry">
          <p>
            <CardName :card-id="entry.attackingPokemon.cardId" /> copies
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

        <div v-else-if="entry.type == 'triggerAbility'" class="sub-entry">
          <p>
            <CardName :card-id="entry.abilityPokemon.cardId" />'s <b>{{ entry.abilityName }}</b> is
            activated!
          </p>
        </div>

        <div v-else-if="entry.type == 'coinFlip'" class="sub-entry">
          <p>Flipping a coin... {{ entry.result }}!</p>
        </div>

        <div v-else-if="entry.type == 'coinMultiFlip'" class="sub-entry">
          <p>
            Flipping {{ entry.flips }} {{ entry.flips == 1 ? "coin" : "coins" }}...
            <span v-for="(result, i) in entry.results" :key="i"> {{ result }}! </span>
            (Total: {{ entry.results.filter((x) => x == "Heads").length }} heads)
          </p>
        </div>

        <div v-else-if="entry.type == 'coinFlipUntilTails'" class="sub-entry">
          <p>
            Flipping until tails...
            <span v-for="(result, i) in entry.results" :key="i"> {{ result }}! </span>
            (Total: {{ entry.results.filter((x) => x == "Heads").length }} heads)
          </p>
        </div>

        <div v-else-if="entry.type == 'damagePrevented'" class="sub-entry">
          <p>
            <CardName :card-id="entry.targetPokemon.cardId" /> prevented
            <span v-if="entry.damageType == 'Damage'"> damage</span>
            <span v-else-if="entry.damageType == 'Effect'"> an effect</span>
            <span v-else-if="entry.damageType == 'SpecialCondition'"> a Special Condition</span>
            from the attack!
          </p>
        </div>

        <div v-else-if="entry.type == 'attackFailed'" class="sub-entry">
          <p>The attack did nothing...</p>
        </div>

        <div v-else-if="entry.type == 'pokemonHealed'" class="sub-entry">
          <p>
            <CardName :card-id="entry.targetPokemon.cardId" /> is healed for
            {{ entry.healingDealt }} damage! <HpChange :event="entry" />
          </p>
        </div>

        <div v-else-if="entry.type == 'pokemonDamaged'" class="sub-entry">
          <p v-if="entry.weaknessBoost">It's super effective!</p>
          <p>
            <CardName :card-id="entry.targetPokemon.cardId" /> is hit for
            {{ entry.damageDealt }} damage! <HpChange :event="entry" />
          </p>
        </div>

        <div v-else-if="entry.type == 'pokemonHpSet'" class="sub-entry">
          <p>
            <CardName :card-id="entry.targetPokemon.cardId" />'s HP is now {{ entry.finalHP }}!
            <HpChange :event="entry" />
          </p>
        </div>

        <div v-else-if="entry.type == 'specialConditionApplied'" class="sub-entry">
          <p v-for="(condition, i) in entry.specialConditions" :key="i">
            <CardName :card-id="entry.targetPokemon.cardId" /> is now {{ condition }}!
          </p>
        </div>

        <div v-else-if="entry.type == 'specialConditionDamage'" class="sub-entry">
          <p>
            <CardName :card-id="entry.targetPokemon.cardId" /> takes {{ entry.damageDealt }} damage
            from being {{ entry.specialCondition }}! <HpChange :event="entry" />
          </p>
        </div>

        <div v-else-if="entry.type == 'specialConditionEffective'" class="sub-entry">
          <CardName :card-id="entry.targetPokemon.cardId" /> is {{ entry.specialCondition
          }}<span v-if="entry.specialCondition !== 'Confused'"> and cannot move</span>!
        </div>

        <div v-else-if="entry.type == 'specialConditionEnded'" class="sub-entry">
          <p v-for="(condition, i) in entry.specialConditions" :key="i">
            <CardName :card-id="entry.targetPokemon.cardId" /> recovered from being {{ condition }}!
          </p>
        </div>

        <div v-else-if="entry.type == 'pokemonKnockedOut'" class="sub-entry">
          <p><CardName :card-id="entry.targetPokemon.cardId" /> is knocked out!</p>
        </div>

        <div v-else-if="entry.type == 'scorePrizePoints'" class="sub-entry">
          <p>
            <b>{{ entry.player }}</b> scores
            <CountDisplay :count="entry.prizePointsScored" single="prize point" />! (Total:
            {{ entry.totalPrizePoints }})
          </p>
        </div>

        <div v-else-if="entry.type == 'discardCards'" class="sub-entry">
          <p v-if="entry.source == 'inPlay' || entry.source == 'hand'">
            <CountDisplay :count="entry.cardIds" single="card" /> discarded:
            <CardNameList :card-ids="entry.cardIds" />.
          </p>
          <p v-else>
            <b>{{ entry.player }}</b> discards
            <CountDisplay :count="entry.cardIds" single="card" /> from their {{ entry.source }}!
          </p>
        </div>

        <div
          v-else-if="entry.type == 'returnToHand' || entry.type == 'returnToDeck'"
          class="sub-entry"
        >
          <p>
            <CountDisplay :count="entry.cardIds" single="card" /> returned to
            <b>{{ entry.player }}</b
            >'s {{ entry.type == "returnToHand" ? "hand" : "deck"
            }}<span v-if="entry.source == 'inPlay' || shownPlayers.includes(entry.player)"
              >: <CardNameList :card-ids="entry.cardIds" /> </span
            >.
          </p>
        </div>

        <div v-else-if="entry.type == 'returnToBottomOfDeck'" class="sub-entry">
          <p>
            <CountDisplay :count="entry.cardIds" single="card" /> returned to bottom of
            <b>{{ entry.player }}</b
            >'s deck<span v-if="shownPlayers.includes(entry.player)"
              >: <CardNameList :card-ids="entry.cardIds" /> </span
            >.
          </p>
        </div>

        <div v-else-if="entry.type == 'shuffleDeck'" class="sub-entry">
          <p>
            <b>{{ entry.player }}</b> shuffles their deck.
          </p>
        </div>

        <div v-else-if="entry.type == 'viewCards'" class="sub-entry">
          <p>
            <b>{{ entry.player }}</b> is viewing
            <CountDisplay :count="entry.cardIds" single="card" /><span
              v-if="shownPlayers.includes(entry.player)"
              >: <CardNameList :card-ids="entry.cardIds" /> </span
            >.
          </p>
        </div>

        <div v-else-if="entry.type == 'selectActivePokemon'" class="sub-entry">
          <p>
            <b>{{ entry.player }}</b> chooses <CardName :card-id="entry.toPokemon.cardId" /> as
            their next Active Pokémon!
          </p>
        </div>

        <h5 v-else-if="entry.type == 'pokemonCheckup'">Pokémon Checkup phase</h5>

        <div v-else-if="entry.type == 'gameOver'">
          <p v-if="entry.winner">
            Game over: <b>{{ entry.winner }}</b> is victorious! ({{ entry.reason }})
          </p>
          <p v-else>Game over: draw... ({{ entry.reason }})</p>
        </div>

        <div v-else-if="entry.type == 'actionFailed'" class="sub-entry">
          <p v-if="entry.reason == 'partiallyImplemented'">
            Part of this effect is not yet implemented...
          </p>
          <p v-else-if="entry.reason == 'notImplemented'">This effect is not yet implemented...</p>
          <p v-else-if="entry.reason == 'noBenchedPokemon'">Player has no benched Pokemon.</p>
          <p v-else-if="entry.reason == 'benchFull'">Player's bench is full.</p>
          <p v-else-if="entry.reason == 'noValidTargets'">Effect has no valid targets.</p>
          <p v-else-if="entry.reason == 'noValidCards'">No valid cards available.</p>
          <p v-else-if="entry.reason == 'conditionNotMet'">
            A condition of the effect has not been met.
          </p>
          <p v-else>Unknown reason: {{ entry.reason }}</p>
        </div>

        <p v-else>{{ entry }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameLogger } from "@/core";

export interface Props {
  gameLog?: GameLogger;
  shownPlayers: string[];
}
defineProps<Props>();
</script>

<style scoped>
.game-log {
  max-width: 500px;
}
:deep(.energy-icon) {
  height: 1.25em;
  margin-bottom: -4px;
}
.sub-entry {
  margin-left: 10px;
  font-size: 0.9em;
}
</style>
