import type { Deck, Energy, GameRules, Move, PokemonCard } from "@/types";

export const useDeckValidator = (rules: GameRules) => {
  const hasCorrectAmountOfCards = (deck: Deck) =>
    deck.Cards.length == rules.DeckSize;

  const hasBasicPokemon = (deck: Deck) =>
    deck.Cards.some((card) => card.CardType == "Pokemon" && card.Stage == 0);

  const hasNoMoreThanTwoWithSameName = (deck: Deck) => {
    for (const name of new Set(deck.Cards.map((card) => card.Name)))
      if (deck.Cards.filter((card) => card.Name == name).length > 2)
        return false;
    return true;
  };

  const canUseMove = (move: Move, energyTypes: Energy[]) =>
    move.RequiredEnergy.every(
      (energy) => energy == "Colorless" || energyTypes.includes(energy)
    );
  const canUseAnyMove = (card: PokemonCard, energyTypes: Energy[]) =>
    card.Moves.some((move) => canUseMove(move, energyTypes));
  const anyCanUseAnyMove = (deck: Deck) =>
    deck.Cards.some(
      (card) =>
        card.CardType == "Pokemon" && canUseAnyMove(card, deck.EnergyTypes)
    );

  const validateDeck = (deck: Deck) => {
    if (!hasCorrectAmountOfCards(deck)) {
      return `Deck must consist of exactly ${rules.DeckSize} cards`;
    }

    if (!hasBasicPokemon(deck)) {
      return "Cannot use a deck with no Basic Pokemon";
    }

    if (!hasNoMoreThanTwoWithSameName(deck)) {
      return "Cannot use more than two cards with the same name";
    }

    if (!anyCanUseAnyMove(deck)) {
      return "Must be able to use at least one attack";
    }

    return true;
  };
  return { validateDeck };
};
