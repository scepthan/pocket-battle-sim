const card_data = await fetch("https://www.pokemon-zone.com/api/game/game-data/").then(x=>x.json()).then(x=>x.data.cards);

const convertEnergy = (energy) =>
  energy.toLowerCase() == "fire" ? "R" :
  energy.toLowerCase() == "dragon" ? "X" : energy[0].toUpperCase();
const fixDescription = (text) =>
  text.replace(/<span class="energy-text energy-text--type-(\w+)"><\/span>/g, (_, type) => `{${ convertEnergy(type) }}`)
      .replace(/<br \/>/g, " ")
      .replace(/<.+?>/g, "")
      .replace(/\xA0/g, " ");

const output_cards = [];
for (const card of card_data) {
  const new_card = {
    name: card.name,
    rarity: card.rarity,
  };

  if (card.pokemon) {
    const pokemon = card.pokemon;
    new_card.cardType = "Pokemon";
    new_card.type = pokemon.pokemonTypes[0];
    new_card.hp = pokemon.hp;
    new_card.stage = pokemon.evolutionStageNumber;
    if (pokemon.previousEvolution)
      new_card.previousEvolution = pokemon.previousEvolution.name;
    new_card.retreatCost = pokemon.retreatAmount;
    if (pokemon.weaknessType && pokemon.weaknessType !== "UNSPECIFIED")
      new_card.weakness = pokemon.weaknessType;
    new_card.attacks = pokemon.pokemonAttacks.map(attack => {
      const new_attack = {
        name: attack.name,
        cost: attack.attackCost.map(convertEnergy).join(""),
      };
      if (!attack.isNoDamage)
        new_attack.damage = attack.damage;
      if (attack.damageSymbolLabel)
        new_attack.damageSymbol = attack.damageSymbolLabel;
      if (attack.description)
        new_attack.text = fixDescription(attack.description);
      return new_attack;
    });
    if (pokemon.pokemonAbilities.length > 0)
      new_card.ability = pokemon.pokemonAbilities.map(ability => ({
        name: ability.name,
        text: fixDescription(ability.description),
      }))[0];
    if (pokemon.isUltraBeast)
      new_card.isUltraBeast = true;
  }
  else if (card.trainer) {
    const trainer = card.trainer;
    new_card.cardType = trainer.trainerType;
    new_card.text = fixDescription(trainer.description);
  }

  for (const {expansionId, collectionNumber} of card.expansionCollectionNumbers)
    output_cards.push(Object.assign({
      id: expansionId + "-" + ("000" + collectionNumber).slice(-3),
      setId: expansionId
    }, new_card));
}
output_cards.sort((a, b) => (a.id > b.id) - (a.id < b.id));
console.log(output_cards.map(JSON.stringify).join(',\n'));