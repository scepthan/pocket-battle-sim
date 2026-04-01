import type { Game } from "../Game";
import type { InPlayPokemon } from "../InPlayPokemon";

export const usedSpecificAttackLastTurn =
  (attackName: string) => (game: Game, self: InPlayPokemon) =>
    game.GameLog.turns[2]?.some(
      (e) => e.type === "useAttack" && e.attackName === attackName && e.player === self.player.Name,
    ) ?? false;

export const selfDamagedByAttackLastTurn = (game: Game, self: InPlayPokemon) =>
  game.GameLog.previousTurn?.some(
    (e) =>
      e.type === "pokemonDamaged" &&
      e.fromAttack &&
      e.targetPokemon.id === self.id &&
      e.targetPokemon.location === "Active",
  ) ?? false;

export const selfMovedToActiveThisTurn = (game: Game, self: InPlayPokemon) => {
  // If any switching has happened this turn, then this condition is necessarily met
  const switchingEvents = game.GameLog.currentTurn.filter(
    (event) => event.type === "selectActivePokemon" || event.type === "swapActivePokemon",
  );
  return switchingEvents.some((event) => event.player === self.player.Name);
};

export const opposingPokemonKnockedOutByCurrentAttack = (game: Game, self: InPlayPokemon) => {
  const damageEvents = game.GameLog.currentTurn.filter((event) => event.type === "pokemonDamaged");
  const activeAttackEvent = damageEvents.find(
    (event) =>
      event.player === self.opponent.Name &&
      event.targetPokemon.location === "Active" &&
      event.fromAttack,
  );
  if (!activeAttackEvent) return false;
  return activeAttackEvent.finalHP === 0;
};

export const ownPokemonKnockedOutByAttackLastTurn = (game: Game, self: InPlayPokemon) =>
  game.GameLog.previousTurn?.some(
    (e) => e.type === "pokemonKnockedOut" && e.fromAttack && e.player === self.player.Name,
  ) ?? false;
