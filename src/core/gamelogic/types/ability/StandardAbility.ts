import type {
  CardSlot,
  Energy,
  Game,
  InPlayPokemonCard,
  PokemonEffect,
  TargetedPokemonEffect,
} from "@/core";
import type { BaseAbility } from "./Ability";

export type AbilityTrigger =
  | { type: "Manual"; multiUse: boolean }
  | { type: "OnEnterPlay"; excludeSetup?: boolean }
  | { type: "AfterDamagedByAttack" }
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
  findValidTargets: (game: Game, self: InPlayPokemonCard) => CardSlot[];
  effect: TargetedPokemonEffect;
}

export interface StandardAbility extends BaseAbility {
  type: "Standard";
  trigger: AbilityTrigger;
  effect: StandardAbilityEffect | TargetedAbilityEffect;
}
