import type { Energy, InPlayPokemon, Player, PokemonEffect, TargetedPokemonEffect } from "@/core";
import type { BaseAbility } from "./Ability";

export type AbilityTrigger =
  | { type: "Manual"; multiUse: boolean }
  | { type: "OnEnterPlay"; excludeSetup?: boolean }
  | { type: "AfterDamagedByAttack" }
  | { type: "BeforeKnockedOutByAttack" }
  | { type: "AfterKnockedOutByAttack" }
  | { type: "OnEnergyZoneAttach"; energy?: Energy }
  | { type: "OnEndOwnTurn"; firstOnly?: boolean }
  | { type: "OnPokemonCheckup" };

interface StandardAbilityEffect {
  type: "Standard";
  effect: PokemonEffect;
}
interface TargetedAbilityEffect {
  type: "Targeted";
  validTargets: (player: Player, self: InPlayPokemon) => InPlayPokemon[];
  effect: TargetedPokemonEffect;
}

export interface StandardAbility extends BaseAbility {
  type: "Standard";
  trigger: AbilityTrigger;
  effect: StandardAbilityEffect | TargetedAbilityEffect;
}
