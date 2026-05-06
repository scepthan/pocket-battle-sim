import { randomElement, removeElement } from "@/core/util";
import type { Game } from "../Game";
import type { InPlayPokemon } from "../InPlayPokemon";
import type { PlayingCard, PlayingCardPredicate } from "../types";

/**
 * Given a playing card predicate, returns a side effect that lets the player look at the top card
 * of their deck. If that card matches the predicate, it is put into their hand, otherwise it is
 * put on the bottom of their deck.
 */
export const MythicalSlab =
  (predicate: PlayingCardPredicate) => async (game: Game, self: InPlayPokemon) => {
    const topCard = self.player.Deck.shift()!;
    await game.showCards(self.player, [topCard]);

    if (predicate(topCard)) {
      self.player.Hand.push(topCard);
      game.GameLog.putIntoHand(self.player, [topCard]);
    } else {
      self.player.Deck.push(topCard);
      game.GameLog.returnToBottomOfDeck(self.player, [topCard]);
    }
  };

/**
 * Given a playing card predicate and an amount of cards to look at, returns a side effect that
 * lets the player look at that many cards from the top of their deck and keep any that match the
 * predicate. The rest are shuffled back into their deck.
 */
export const TravelingMerchant =
  (predicate: PlayingCardPredicate, count: number) => async (game: Game, self: InPlayPokemon) => {
    const topCards = self.player.Deck.splice(0, count);
    await game.showCards(self.player, topCards);

    const matchingCards: PlayingCard[] = [];
    const nonMatchingCards: PlayingCard[] = [];

    for (const card of topCards) {
      if (predicate(card)) {
        matchingCards.push(card);
      } else {
        nonMatchingCards.push(card);
      }
    }

    self.player.Hand.push(...matchingCards);
    self.player.Deck.push(...nonMatchingCards);

    game.GameLog.putIntoHand(self.player, matchingCards);
    game.GameLog.returnToDeck(self.player, nonMatchingCards, "hand");

    self.player.shuffleDeck();
  };

/**
 * Given a playing card predicate, returns a side effect that lets the player swap a matching
 * card from their hand with a random matching card from their deck.
 */
export const PokemonCommunication =
  (predicate: PlayingCardPredicate) => async (game: Game, self: InPlayPokemon) => {
    const validHandCards = self.player.Hand.filter(predicate);
    const prompt = "Choose a card from your hand to swap with a card from your deck.";
    const chosen = await game.chooseCard(self.player, validHandCards, prompt);
    if (!chosen) return;

    const validDeckCards = self.player.Deck.filter(predicate);
    if (validDeckCards.length == 0) {
      game.GameLog.noValidCards(self.player);
      return;
    }
    const cardFromDeck = randomElement(validDeckCards);

    removeElement(self.player.Hand, chosen);
    self.player.Deck.push(chosen);
    game.GameLog.returnToDeck(self.player, [chosen], "hand");

    removeElement(self.player.Deck, cardFromDeck);
    self.player.Hand.push(cardFromDeck);
    game.GameLog.putIntoHand(self.player, [cardFromDeck]);

    self.player.shuffleDeck();
  };

/**
 * A side effect that lets the player view a random Supporter card from their opponent's deck, then
 * use the effect of that card.
 */
export const Penny = async (game: Game, self: InPlayPokemon) => {
  const supporters = self.opponent.Deck.filter((card) => card.cardType === "Supporter").filter(
    (card) => card.name !== "Penny",
  );
  if (supporters.length === 0) {
    game.GameLog.noValidCards(self.player);
    return;
  }
  const chosenCard = randomElement(supporters);
  await game.showCards(self.player, [chosenCard]);
  self.opponent.returnFromHandToDeck([chosenCard]);
  self.opponent.shuffleDeck();
  await game.copyTrainer(chosenCard);
};

/**
 * Given a Pokémon predicate and a boolean indicating whether to target the opponent, returns a
 * side effect that counts the number of Pokémon the player has in play that match the predicate,
 * then lets them rearrange that many cards from the top of the targeted player's deck.
 */
export const HikerAndMorty =
  (opponent: boolean) => async (game: Game, self: InPlayPokemon, count: number) => {
    const affectedPlayer = opponent ? self.opponent : self.player;

    const topCards = affectedPlayer.Deck.splice(0, count);
    const prompt = "Choose the order in which to put the cards back on your deck.";
    const rearranged = await game.rearrangeCards(self.player, topCards, prompt);

    affectedPlayer.Deck.unshift(...rearranged);
    game.GameLog.returnToTopOfDeck(self.player, rearranged, opponent ? self.opponent : undefined);
  };
