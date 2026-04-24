import type { Attack, Deck, Energy, GameRules, PokemonCard } from "../gamelogic";

export const useDeckValidator = (rules: GameRules) => {
  const hasCorrectAmountOfCards = (deck: Deck) => deck.Cards.length == rules.DeckSize;

  const hasBasicPokemon = (deck: Deck) =>
    deck.Cards.some((card) => card.cardType == "Pokemon" && card.stage == 0);

  const hasNoMoreThanTwoWithSameName = (deck: Deck) => {
    for (const name of new Set(deck.Cards.map((card) => card.name)))
      if (deck.Cards.filter((card) => card.name == name).length > 2) return false;
    return true;
  };

  const canUseAttack = (attack: Attack, energyTypes: Energy[]) =>
    attack.requiredEnergy.every((energy) => energy == "Colorless" || energyTypes.includes(energy));
  const canUseAnyAttack = (card: PokemonCard, energyTypes: Energy[]) =>
    card.attacks.some((attack) => canUseAttack(attack, energyTypes));
  const anyCanUseAnyAttack = (deck: Deck) =>
    deck.Cards.some(
      (card) => card.cardType == "Pokemon" && canUseAnyAttack(card, deck.EnergyTypes),
    );

  const validateDeck = (deck: Deck) => {
    const errors = [];

    if (!hasCorrectAmountOfCards(deck)) {
      errors.push(`Deck must consist of exactly ${rules.DeckSize} cards`);
    }

    if (!hasBasicPokemon(deck)) {
      errors.push("Deck must contain at least 1 Basic Pokémon");
    }

    if (!hasNoMoreThanTwoWithSameName(deck)) {
      errors.push("Deck cannot contain more than two cards with the same name");
    }

    if (!anyCanUseAnyAttack(deck)) {
      errors.push("Must be able to use at least one attack");
    }

    if (rules.ExtraValidation) {
      const extraValidation = rules.ExtraValidation(deck);
      if (extraValidation !== true) {
        errors.push(extraValidation);
      }
    }

    if (errors.length > 0) return errors;
    else return true;
  };
  return { validateDeck };
};
