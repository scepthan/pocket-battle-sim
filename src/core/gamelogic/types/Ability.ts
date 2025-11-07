import type {
  CardSlot,
  Energy,
  Game,
  InPlayPokemonCard,
  PlayerStatus,
  PokemonCondition,
  PokemonEffect,
  PokemonStatus,
  TargetedPokemonEffect,
} from "..";

export type AbilityTrigger =
  | { type: "Manual"; multiUse: boolean }
  | { type: "OnEnterPlay"; excludeSetup?: boolean }
  | { type: "AfterDamagedByAttack" }
  | { type: "AfterKnockedOutByAttack" }
  | { type: "OnEnergyZoneAttach"; energy?: Energy }
  | { type: "OnEndOwnTurn"; firstOnly?: boolean }
  | { type: "OnPokemonCheckup" };

interface StandardEffect {
  type: "Standard";
  effect: PokemonEffect;
}
interface TargetedEffect {
  type: "Targeted";
  findValidTargets: (game: Game, self: InPlayPokemonCard) => CardSlot[];
  effect: TargetedPokemonEffect;
}
interface PlayerStatusEffect {
  type: "PlayerStatus";
  status: PlayerStatus;
  opponent: boolean;
}
interface PokemonStatusEffect {
  type: "PokemonStatus";
  status: PokemonStatus;
}
export type StatusAbilityEffect = PlayerStatusEffect | PokemonStatusEffect;

interface BaseAbility {
  name: string;
  text: string;
  conditions: PokemonCondition[];
}
interface StandardAbility extends BaseAbility {
  type: "Standard";
  trigger: AbilityTrigger;
  effect: StandardEffect | TargetedEffect;
}
interface StatusAbility extends BaseAbility {
  type: "Status";
  effect: StatusAbilityEffect;
}
export type Ability = StandardAbility | StatusAbility;
