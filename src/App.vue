<template>
  <v-app>
    <v-app-bar>
      <v-app-bar-title style="flex-basis: auto; flex-grow: 0; margin-right: 32px">
        Pocket Battle Simulator
      </v-app-bar-title>

      <AppBarMenu />
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { rarityShort } from "./assets";
import { sortedBy, type PlayingCard } from "./core";
import { useDeckStore, usePlayingCardStore } from "./stores";

const cardStore = usePlayingCardStore();
const deckStore = useDeckStore();

const debugUnimplementedCards = false;
const debugUnusedCards = false;
const debugUniqueEffects = false;

onMounted(() => {
  const decklists = deckStore.BuiltinDecklists;
  const cards = cardStore.Cards;
  const encounteredCards = new Set<string>();

  let sortedCards = sortedBy(cards, (card) => card.rarity, rarityShort);
  sortedCards = sortedBy(sortedCards, (a) => a.id > "PROMO-A-007");

  const uniqueCards = sortedCards
    .filter((card) => {
      const baseCard = {
        name: card.name,
        cardType: card.cardType,
      };
      let functionalCard;
      if (card.cardType === "Pokemon") {
        functionalCard = {
          ...baseCard,
          type: card.type,
          baseHP: card.baseHP,
          retreatCost: card.retreatCost,
          ability: card.ability,
          attacks: card.attacks,
        };
      } else {
        functionalCard = {
          ...baseCard,
          text: card.text,
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

  if (debugUnimplementedCards) {
    console.log(
      uniqueCards
        .filter((c) => !c.parseSuccessful)
        .map((c) => `- ${c.id} ${c.name}`)
        .join("\n"),
    );
  }

  if (debugUniqueEffects) {
    const effects: Record<string, PlayingCard[]> = {};
    const addEffect = (text: string, card: PlayingCard) => {
      const newText = text.replace(/\d+/g, "<number>").replace(/\{\w\}/g, "<type>");

      if (!effects[newText]) {
        effects[newText] = [card];
        console.log("New effect #", Object.keys(effects).length, "found:", newText, card);
      } else {
        effects[newText].push(card);
      }
    };

    for (const card of uniqueCards) {
      if (card.cardType === "Pokemon") {
        if (card.ability) addEffect(card.ability.text, card);
        for (const attack of card.attacks) if (attack.text) addEffect(attack.text, card);
      } else {
        addEffect(card.text, card);
      }
    }
    console.log(Object.keys(effects).sort());
  }

  if (debugUnusedCards) {
    const unusedCards = uniqueCards.filter(
      (card) =>
        !Object.values(decklists).some((decks) =>
          Object.values(decks).some((deck) => deck.Cards.includes(card.id)),
        ),
    );

    const unusedCardGroups: Record<string, PlayingCard[]> = {};
    for (const card of unusedCards) {
      const key = card.cardType === "Pokemon" ? card.type : card.cardType;
      if (!unusedCardGroups[key]) unusedCardGroups[key] = [];
      unusedCardGroups[key].push(card);
    }

    console.log(
      `Found ${unusedCards.length} unused cards:\n${Object.entries(unusedCardGroups)
        .map(
          ([key, cards]) =>
            `- ${key} (${cards.length}): ${cards
              .map((card) => `${card.id} (${card.name})`)
              .join("; ")}`,
        )
        .join("\n")}`,
    );
  }

  for (const [deckName, deck] of Object.entries(deckStore.BuiltinDecks)) {
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
