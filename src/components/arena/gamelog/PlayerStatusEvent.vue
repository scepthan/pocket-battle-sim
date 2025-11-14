<template>
  <p v-if="entry.status.type == 'DecreaseRetreatCost'">
    Retreat cost is {{ entry.status.amount }} less<span v-if="entry.status.descriptor">
      for <b>{{ entry.player }}'s</b> <PokemonDescriptor :text="entry.status.descriptor" /></span
    ><span v-if="entry.status.source == 'Effect'"> for this turn</span>!
  </p>
  <p v-else-if="entry.status.type == 'IncreaseAttack'">
    Attacks used<span v-if="entry.status.descriptor">
      by your <PokemonDescriptor :text="entry.status.descriptor" /></span
    ><span v-if="entry.status.source == 'Effect'"> this turn</span> do +{{ entry.status.amount }}
    damage to the opponent's Active Pokemon!
  </p>
  <p v-else-if="entry.status.type == 'IncreaseDefense'">
    Attacks used<span v-if="entry.status.source == 'Effect'"> next turn</span> do -{{
      entry.status.amount
    }}
    damage to <b>{{ entry.player }}</b
    >'s <PokemonDescriptor :text="entry.status.descriptor" />!
  </p>
  <p v-else-if="entry.status.type == 'CannotEvolve'">
    <b>{{ entry.player }}</b> cannot evolve their
    <PokemonDescriptor :text="entry.status.descriptor" /><span
      v-if="entry.status.source == 'Effect'"
    >
      next turn</span
    >!
  </p>
  <p v-else-if="entry.status.type == 'CannotUseSupporter'">
    <b>{{ entry.player }}</b> cannot use Supporter cards from their hand<span
      v-if="entry.status.source == 'Effect'"
    >
      next turn</span
    >!
  </p>
  <p v-else-if="entry.status.type == 'DoubleEnergy'">
    All of <b>{{ entry.player }}</b
    >'s <PokemonDescriptor :text="entry.status.descriptor" /> now have their
    <EnergyIcon inline :energy="entry.status.energyType" /> count as double!
  </p>
  <p v-else-if="entry.status.type == 'CannotUseItem'">
    <b>{{ entry.player }}</b> cannot use Item cards from their hand<span
      v-if="entry.status.source == 'Effect'"
    >
      next turn</span
    >!
  </p>
  <p v-else-if="entry.status.type == 'ReduceAttackCost'">
    All of <b>{{ entry.player }}</b
    >'s <PokemonDescriptor :text="entry.status.descriptor" /> have their attack cost reduced by
    {{ entry.status.amount }} <EnergyIcon inline :energy="entry.status.energyType" /><span
      v-if="entry.status.source == 'Effect'"
    >
      this turn</span
    >!
  </p>
  <p v-else>Unknown player status: {{ entry.status.type }}</p>
</template>

<script setup lang="ts">
import type { LoggedEvent } from "@/core";

export interface Props {
  entry: LoggedEvent & { type: "applyPlayerStatus" };
}
defineProps<Props>();
</script>
