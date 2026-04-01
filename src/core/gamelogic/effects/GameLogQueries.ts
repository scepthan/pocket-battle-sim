import type { Game } from "../Game";
import type { InPlayPokemon } from "../InPlayPokemon";

export const countTimesAttackUsed = (game: Game, self: InPlayPokemon, attackName: string) =>
  game.GameLog.entries.filter(
    (e) => e.type === "useAttack" && e.attackName === attackName && e.player === self.player.Name,
  ).length;

export const damageDoneToOpposingPokemonByCurrentAttack = (game: Game, self: InPlayPokemon) => {
  const damageEvents = game.GameLog.currentTurn.filter((event) => event.type === "pokemonDamaged");
  const activeAttackEvent = damageEvents.find(
    (event) =>
      event.player === self.opponent.Name &&
      event.targetPokemon.location === "Active" &&
      event.fromAttack,
  );
  if (!activeAttackEvent) return;
  return activeAttackEvent.damageDealt;
};

export const pokemonDiscardedFromPlayByCurrentAttack = (game: Game, self: InPlayPokemon) => {
  const attackIndex = game.GameLog.currentTurn.findIndex((event) => event.type === "useAttack");
  if (attackIndex === -1) return 0;
  return game.GameLog.currentTurn
    .slice(attackIndex)
    .filter((event) => event.type === "pokemonDiscarded" && event.player === self.player.Name)
    .length;
};
