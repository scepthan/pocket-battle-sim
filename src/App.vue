<template>
  <v-app>
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { usePlayingCardStore } from "./stores/usePlayingCardStore";
import type { DeckInfo, InputCard } from "./types";

const cardStore = usePlayingCardStore();

onMounted(async () => {
  await cardStore.loadCards();

  const decklists = (await import("@/assets/decks.json")).default as Record<
    string,
    Record<string, DeckInfo>
  >;

  const cards = (await import("@/assets/cards.json")).default as InputCard[];
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
    .sort(
      (a, b) =>
        rarityIndex(a.Rarity) - rarityIndex(b.Rarity) ||
        a.ID.localeCompare(b.ID)
    )
    .filter((card) => {
      const baseCard = {
        Name: card.Name,
        CardType: card.CardType,
      };
      let functionalCard;
      if (card.CardType === "Pokemon") {
        functionalCard = {
          ...baseCard,
          Type: card.Type,
          HP: card.HP,
          RetreatCost: card.RetreatCost,
          Ability: card.Ability,
          Moves: card.Moves,
        };
      } else {
        functionalCard = {
          ...baseCard,
          Text: card.Text,
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
    .sort((a, b) => a.ID.localeCompare(b.ID));

  console.log(
    `Loaded ${uniqueCards.length} unique cards from ${cards.length} total cards.`
  );

  const unusedCards = uniqueCards.filter(
    (card) =>
      !Object.values(decklists).some((decks) =>
        Object.values(decks).some((deck) => deck.Cards.includes(card.ID))
      )
  );

  console.log(
    `Found ${unusedCards.length} unused cards:`,
    unusedCards.map((card) => `${card.ID} (${card.Name})`).join("; ")
  );
});
</script>

<style scoped>
div.v-application {
  background-color: #c0d8ef;
}
</style>
