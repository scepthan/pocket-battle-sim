<template>
  <div v-if="entry.status.type == 'PokemonStatus'">
    <div v-if="pokemonStatus">
      <p v-if="pokemonStatus.type == 'ModifyRetreatCost'">
        Retreat cost is {{ Math.abs(pokemonStatus.amount) }}
        {{ pokemonStatus.amount < 0 ? "less" : "more"
        }}<span v-if="descriptor">
          for <b>{{ entry.player }}</b
          >'s <PokemonDescriptor :text="descriptor" /></span
        ><span v-if="entry.status.source == 'Effect'"> for this turn</span>!
      </p>
      <p v-else-if="pokemonStatus.type == 'ModifyAttackDamage'">
        Attacks used<span v-if="descriptor">
          by <b>{{ entry.player }}</b
          >'s <PokemonDescriptor :text="descriptor" /></span
        ><span v-if="entry.status.source == 'Effect'"> this turn</span> do
        <SignedNumber :number="pokemonStatus.amount" /> damage to the opponent's Active Pokémon!
      </p>
      <p v-else-if="pokemonStatus.type == 'ModifyIncomingAttackDamage'">
        Attacks used<span v-if="entry.status.source == 'Effect'"> next turn</span> do
        <SignedNumber :number="pokemonStatus.amount" /> damage to <b>{{ entry.player }}</b
        >'s <PokemonDescriptor :text="descriptor" />!
      </p>
      <p v-else-if="pokemonStatus.type == 'CannotEvolve'">
        <b>{{ entry.player }}</b> cannot evolve their <PokemonDescriptor :text="descriptor" /><span
          v-if="entry.status.source == 'Effect'"
        >
          next turn</span
        >!
      </p>
      <p v-else-if="pokemonStatus.type == 'CannotAttachFromEnergyZone'">
        <b>{{ entry.player }}</b> cannot attach Energy from their Energy Zone to their
        <PokemonDescriptor :text="descriptor" /><span v-if="entry.status.source == 'Effect'">
          next turn</span
        >!
      </p>
      <p v-else-if="pokemonStatus.type == 'DoubleEnergy'">
        All of <b>{{ entry.player }}</b
        >'s <PokemonDescriptor :text="descriptor" /> now have their
        <EnergyIcon inline :energy="pokemonStatus.energyType" /> count as double!
      </p>
      <p v-else-if="pokemonStatus.type == 'ModifyAttackCost'">
        All of <b>{{ entry.player }}</b
        >'s <PokemonDescriptor :text="descriptor" /> have their attack cost
        {{ pokemonStatus.amount < 0 ? "reduced" : "increased" }} by
        {{ Math.abs(pokemonStatus.amount) }}
        <EnergyIcon inline :energy="pokemonStatus.energyType" /><span
          v-if="entry.status.source == 'Effect'"
        >
          this turn</span
        >!
      </p>
      <p v-else-if="pokemonStatus.type == 'NoRetreatCost'">
        All of <b>{{ entry.player }}</b
        >'s <PokemonDescriptor :text="descriptor" /> have no Retreat Cost<span
          v-if="entry.status.source == 'Effect'"
        >
          this turn</span
        >!
      </p>
      <p v-else>
        Unknown Pokémon status applied to <b>{{ entry.player }}</b
        >'s <PokemonDescriptor :text="descriptor" />: {{ pokemonStatus.type }}
      </p>
    </div>
  </div>
  <p v-else-if="entry.status.type == 'CannotUseSupporter'">
    <b>{{ entry.player }}</b> cannot use Supporter cards from their hand<span
      v-if="entry.status.source == 'Effect'"
    >
      next turn</span
    >!
  </p>
  <p v-else-if="entry.status.type == 'CannotUseItem'">
    <b>{{ entry.player }}</b> cannot use Item cards from their hand<span
      v-if="entry.status.source == 'Effect'"
    >
      next turn</span
    >!
  </p>
  <p v-else>
    Unknown player status applied to <b>{{ entry.player }}</b
    >: {{ entry.status.type }}
  </p>
</template>

<script setup lang="ts">
import type { LoggedEvent } from "@/core";

export interface Props {
  entry: LoggedEvent & { type: "applyPlayerStatus" };
}
const props = defineProps<Props>();

const pokemonStatus = computed(() =>
  props.entry.status.type === "PokemonStatus" ? props.entry.status.pokemonStatus : null
);
const descriptor = computed(() =>
  props.entry.status.type === "PokemonStatus" ? props.entry.status.pokemonCondition.descriptor : ""
);
</script>
