<template>
  <v-app>
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useDeckStore, usePlayingCardStore } from "./stores";

const cardStore = usePlayingCardStore();
const deckStore = useDeckStore();
const debugMultiUseCards = false;

onMounted(() => {
  const decklists = deckStore.Decks;
  const cards = cardStore.InputCards;
  const encounteredCards = new Set<string>();
  const rarityIndex = (a: string) =>
    [
      "Common",
      "Uncommon",
      "Rare",
      "Double Rare",
      "Art Rare",
      "Super Rare",
      "Special Art Rare",
      "Immersive Rare",
      "Ultra Rare",
      "Promo",
    ].indexOf(a);

  const uniqueCards = cards
    .slice()
    .sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity) || a.id.localeCompare(b.id))
    .filter((card) => {
      const baseCard = {
        Name: card.name,
        CardType: card.cardType,
      };
      let functionalCard;
      if (card.cardType === "Pokemon") {
        functionalCard = {
          ...baseCard,
          Type: card.type,
          HP: card.hp,
          RetreatCost: card.retreatCost,
          Ability: card.ability,
          Moves: card.attacks,
        };
      } else {
        functionalCard = {
          ...baseCard,
          Text: card.text,
        };
      }

      const cardString = JSON.stringify(functionalCard);
      if (encounteredCards.has(cardString)) {
        return false;
      } else {
        encounteredCards.add(cardString);
        return true;
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`Loaded ${uniqueCards.length} unique cards from ${cards.length} total cards.`);

  const unusedCards = uniqueCards.filter(
    (card) =>
      !Object.values(decklists).some((decks) =>
        Object.values(decks).some((deck) => deck.Cards.includes(card.id))
      )
  );

  console.log(
    `Found ${unusedCards.length} unused cards:`,
    unusedCards.map((card) => `${card.id} (${card.name})`).join("; ")
  );

  if (debugMultiUseCards) {
    const multiUseCards = uniqueCards.filter(
      (card) =>
        Object.values(decklists).flatMap((decks) =>
          Object.values(decks).filter((deck) => deck.Cards.includes(card.id))
        ).length > 1
    );

    console.log(
      `Found ${multiUseCards.length} multi-use cards:\n`,
      multiUseCards
        .map(
          (card) =>
            `${card.id} (${card.name}): ${Object.entries(decklists)
              .flatMap(([setName, set]) =>
                Object.entries(set).flatMap(([deckName, deck]) =>
                  deck.Cards.includes(card.id) ? `${deckName} (${setName})` : []
                )
              )
              .join(", ")}`
        )
        .join("\n")
    );
  }

  for (const [deckName, deck] of Object.entries(deckStore.AllDecks)) {
    if (deck.Cards.length !== 20) {
      console.warn(`Deck "${deckName}" has ${deck.Cards.length} cards (expected 20).`);
    }
  }
});
</script>

<style scoped>
div.v-application {
  background-color: #c0d8ef;
}
</style>
