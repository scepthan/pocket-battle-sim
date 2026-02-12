import { allCards } from "@/assets";
import type { InPlayPokemon } from "../InPlayPokemon";
import type { Player } from "../Player";
import type { PokemonCard } from "../types";

const findBasicForStage2 = (stage2: PokemonCard) => {
  const stage1Name = stage2.EvolvesFrom;
  if (!stage1Name) return null;
  const stage1 = allCards.find((card) => card.name === stage1Name);
  if (!stage1 || stage1.cardType !== "Pokemon") return null;
  return stage1.previousEvolution ?? null;
};

export const findValidRareCandyTargets = (player: Player) => {
  const validBasicNames = player.Hand.filter(
    (card) => card.CardType === "Pokemon" && card.Stage == 2,
  )
    .map((card) => findBasicForStage2(card as PokemonCard))
    .filter((name) => name !== null);

  return player.InPlayPokemon.filter(
    (p) => p.Stage == 0 && !p.PlayedThisTurn && validBasicNames.includes(p.EvolvesAs),
  );
};

export const evolveWithRareCandy = async (target: InPlayPokemon) => {
  const player = target.player;

  const validCards = player.Hand.filter(
    (card) =>
      card.CardType === "Pokemon" &&
      card.Stage == 2 &&
      findBasicForStage2(card) === target.EvolvesAs,
  );
  const prompt = "Choose a Stage 2 Pokémon to evolve into:";
  const card = await target.game.chooseCard(player, validCards, prompt);
  if (!card) return;

  await player.evolvePokemon(target, card as PokemonCard, true);
};
