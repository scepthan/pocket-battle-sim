import type { CoinFlipIndicator, Energy, InPlayPokemon, Player, SideEffect } from "@/core";
import type { BaseAbility } from "./Ability";

export type AbilityTrigger =
  | { type: "Manual"; multiUse: boolean }
  | { type: "OnEnterPlay"; excludeSetup?: boolean }
  | { type: "OnEvolution"; optional?: boolean }
  | { type: "AfterDamagedByAttack" }
  | { type: "BeforeKnockedOutByAttack" }
  | { type: "AfterKnockedOutByAttack" }
  | { type: "OnEnergyZoneAttach"; energy?: Energy }
  | { type: "OnEndOwnTurn"; firstOnly?: boolean }
  | { type: "OnPokemonCheckup" };

interface BaseAbilityEffect {
  sideEffects: SideEffect[];
  coinsToFlip?: CoinFlipIndicator;
}
interface StandardAbilityEffect extends BaseAbilityEffect {
  type: "Standard";
}
interface TargetedAbilityEffect extends BaseAbilityEffect {
  type: "Targeted";
  validTargets: (player: Player, self: InPlayPokemon) => InPlayPokemon[];
}

export interface StandardAbility extends BaseAbility {
  type: "Standard";
  trigger: AbilityTrigger;
  effect: StandardAbilityEffect | TargetedAbilityEffect;
}
