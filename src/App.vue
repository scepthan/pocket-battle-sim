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
import { sortedBy, type InputCard } from "./core";
import { useDeckStore, usePlayingCardStore } from "./stores";

const cardStore = usePlayingCardStore();
const deckStore = useDeckStore();
const debugMultiUseCards = false;
const debugUniqueEffects = false;

onMounted(() => {
  const decklists = deckStore.BuiltinDecklists;
  const cards = cardStore.InputCards;
  const encounteredCards = new Set<string>();

  let sortedCards = sortedBy(cards, (card) => card.rarity, rarityShort);
  sortedCards = sortedBy(sortedCards, (a) => a.id > "PROMO-A-007");

  const uniqueCards = sortedCards
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
          Attacks: card.attacks,
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

  if (debugUniqueEffects) {
    const effects: Record<string, InputCard[]> = {};
    const addEffect = (text: string, card: InputCard) => {
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

  const unusedCards = uniqueCards.filter(
    (card) =>
      !Object.values(decklists).some((decks) =>
        Object.values(decks).some((deck) => deck.Cards.includes(card.id)),
      ),
  );

  const unusedCardGroups: Record<string, InputCard[]> = {};
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

  if (debugMultiUseCards) {
    const multiUseCards = uniqueCards.filter(
      (card) =>
        Object.values(decklists).flatMap((decks) =>
          Object.values(decks).filter((deck) => deck.Cards.includes(card.id)),
        ).length > 1,
    );

    console.log(
      `Found ${multiUseCards.length} multi-use cards:\n`,
      multiUseCards
        .map(
          (card) =>
            `${card.id} (${card.name}): ${Object.entries(decklists)
              .flatMap(([setName, set]) =>
                Object.entries(set).flatMap(([deckName, deck]) =>
                  deck.Cards.includes(card.id) ? `${deckName} (${setName})` : [],
                ),
              )
              .join(", ")}`,
        )
        .join("\n"),
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
