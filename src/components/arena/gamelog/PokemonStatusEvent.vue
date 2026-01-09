<template>
  <CardName :card-id="entry.targetPokemon.cardId" />
  <span v-if="entry.status.type == 'ModifyIncomingAttackDamage'">
    will take <SignedNumber :number="entry.status.amount" /> damage from attacks</span
  >
  <span v-else-if="entry.status.type == 'ModifyIncomingAttackDamageOnCoinFlip'">
    will flip a coin to take <SignedNumber :number="entry.status.amount" /> damage from
    attacks</span
  >
  <span v-else-if="entry.status.type == 'PreventAttackDamageAndEffects'">
    cannot be affected by attacks</span
  >
  <span v-else-if="entry.status.type == 'PreventAttackDamage'"> cannot be damaged by attacks</span>
  <span v-else-if="entry.status.type == 'PreventAttackEffects'">
    cannot be harmed by effects of attacks</span
  >
  <span v-else-if="entry.status.type == 'CounterAttack'">
    will do {{ entry.status.amount }} damage if attacked</span
  >
  <span v-else-if="entry.status.type == 'ModifyAttackDamage'">
    will attack for <SignedNumber :number="entry.status.amount" /> damage</span
  >
  <span v-else-if="entry.status.type == 'ModifyDamageOfAttack'">
    will attack for <SignedNumber :number="entry.status.amount" /> damage with
    {{ entry.status.attackName }}</span
  >
  <span v-else-if="entry.status.type == 'CannotAttack'"> cannot attack</span>
  <span v-else-if="entry.status.type == 'CannotUseSpecificAttack'">
    cannot use {{ entry.status.attackName }}</span
  >
  <span v-else-if="entry.status.type == 'CoinFlipToAttack'"> must flip a coin to attack</span>
  <span v-else-if="entry.status.type == 'CannotRetreat'"> cannot retreat</span>
  <span v-else-if="entry.status.type == 'NoRetreatCost'"> has no retreat cost</span>
  <span v-else-if="entry.status.type == 'IncreaseMaxHP'">
    has its max HP increased by {{ entry.status.amount }}</span
  >
  <span v-else-if="entry.status.type == 'PreventSpecialConditions'">
    cannot be affected by Special Conditions</span
  >
  <span v-else-if="entry.status.type == 'ModifyAttackCost'">
    has its attack cost {{ entry.status.amount < 0 ? "reduced" : "increased" }} by
    {{ Math.abs(entry.status.amount) }} <EnergyIcon :energy="entry.status.energyType" inline
  /></span>
  <span v-else-if="entry.status.type == 'ModifyRetreatCost'">
    has its retreat cost {{ entry.status.amount < 0 ? "reduced" : "increased" }} by
    {{ Math.abs(entry.status.amount) }} <EnergyIcon energy="Colorless" inline
  /></span>
  <span v-else> has unknown status "{{ entry.status.type }}" applied to it</span
  ><span v-if="'attackerCondition' in entry.status && entry.status.attackerCondition?.descriptor">
    from <PokemonDescriptor :text="entry.status.attackerCondition.descriptor" /></span
  ><span v-if="entry.status.source == 'Effect'"> next turn</span>!
</template>

<script setup lang="ts">
import type { LoggedEvent } from "@/core";

export interface Props {
  entry: LoggedEvent & { type: "applyPokemonStatus" };
}
defineProps<Props>();
</script>
