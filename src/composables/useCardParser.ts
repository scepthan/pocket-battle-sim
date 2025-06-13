import type { GameState } from "@/models/GameState";
import {
  EnergyMap,
  isEnergy,
  isEnergyShort,
  parseEnergy,
  type Ability,
  type Attack,
  type Effect,
  type Energy,
  type InputCard,
  type InputCardAbility,
  type InputCardAttack,
  type ParsedResult,
  type ParsedResultOptional,
  type PlayingCard,
} from "@/types";

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => Effect;
}

export const useCardParser = () => {
  const parseCard = (
    inputCard: InputCard
  ): ParsedResultOptional<PlayingCard> => {
    let parseSuccessful = true;

    if (inputCard.CardType == "Pokemon") {
      const Attacks = inputCard.Moves.map((attack) => {
        const result = parseAttack(attack);
        if (!result.parseSuccessful) parseSuccessful = false;
        return result.value;
      });

      let Ability: Ability | undefined;
      if (inputCard.Ability) {
        const result = parseAbility(inputCard.Ability);
        Ability = result.value;
        if (!result.parseSuccessful) parseSuccessful = false;
      }

      let Type: Energy = "Colorless";
      if (isEnergy(inputCard.Type)) {
        Type = inputCard.Type;
      } else {
        parseSuccessful = false;
      }

      const outputCard = {
        ID: inputCard.ID,
        Name: inputCard.Name,
        CardType: inputCard.CardType,
        Type,
        BaseHP: inputCard.HP,
        Stage: inputCard.Stage,
        EvolvesFrom: inputCard.EvolvesFrom,
        RetreatCost: inputCard.RetreatCost,
        Weakness: inputCard.Weakness,
        PrizePoints: inputCard.Name.endsWith(" ex") ? 2 : 1,
        Attacks,
        Ability,
      };

      return { value: outputCard, parseSuccessful };
    } else if (
      inputCard.CardType == "Item" ||
      inputCard.CardType == "Supporter"
    ) {
      const result = parseTrainerEffect(inputCard.Text);
      if (!result.parseSuccessful) parseSuccessful = false;

      const outputCard = {
        ID: inputCard.ID,
        Name: inputCard.Name,
        CardType: inputCard.CardType,
        Effect: result.value,
      };

      return { value: outputCard, parseSuccessful };
    } else {
      // Would only happen if a card is defined with an invalid CardType
      return { value: undefined, parseSuccessful: false };
    }
  };

  const parseAttack = (inputAttack: InputCardAttack): ParsedResult<Attack> => {
    let parseSuccessful = true;
    const Name = inputAttack.Name;

    const RequiredEnergy: Energy[] = [];
    for (const E of inputAttack.Energy) {
      if (isEnergyShort(E)) RequiredEnergy.push(EnergyMap[E]);
      else parseSuccessful = false;
    }

    const defaultEffect = async (gameState: GameState) => {
      gameState.attackActivePokemon(inputAttack.HP ?? 0);
    };
    if (inputAttack.Effect) {
      const dictionary: EffectTransformer[] = [
        {
          pattern: /^Heal (\d+) damage from this Pokémon\.$/,
          transform: (_, HP) => async (game: GameState) => {
            await defaultEffect(game);
            game.healPokemon(game.AttackingPlayer.ActivePokemon!, Number(HP));
          },
        },
        {
          pattern:
            /^If this Pokémon has at least (\d+) extra (?:{(\w)} )?Energy attached, this attack does (\d+) more damage\.$/,
          transform: (_, energyCount, energyType, extraDamage) => {
            const e = parseEnergy(energyType || "C");
            const secondaryRequiredEnergy = [...RequiredEnergy];
            for (let i = 0; i < Number(energyCount); i++)
              secondaryRequiredEnergy.push(e);

            return async (game: GameState) => {
              const active = game.AttackingPlayer.ActivePokemon!;
              let damage = inputAttack.HP!;
              if (active.hasSufficientEnergy(secondaryRequiredEnergy))
                damage += Number(extraDamage);
              game.attackActivePokemon(damage);
            };
          },
        },
        {
          pattern: /^Draw (a|\d+) cards?\.$/,
          transform: (_, count) => async (game: GameState) => {
            await defaultEffect(game);
            game.drawCards(count == "a" ? 1 : Number(count));
          },
        },
        {
          pattern:
            /^Flip a coin for each (?:{(\w)} )?Energy attached to this Pokémon\. This attack does (\d+) damage for each heads\.$/,
          transform: (_, energyType, damage) => {
            const fullType = energyType ? parseEnergy(energyType) : undefined;
            const predicate = fullType
              ? (e: Energy) => e == fullType
              : () => true;

            return async (game: GameState) => {
              const energy = game.AttackingPlayer.ActivePokemon!.AttachedEnergy;
              const totalFlips = energy.filter(predicate).length;
              const { heads } = game.flipMultiCoin(
                game.AttackingPlayer,
                totalFlips
              );
              game.attackActivePokemon(heads * Number(damage));
            };
          },
        },
        {
          pattern:
            /^This attack does (\d+) more damage for each Energy attached to your opponent's Active Pokémon\.$/,
          transform: (_, extraDamage) => async (game: GameState) => {
            const energyCount =
              game.DefendingPlayer.ActivePokemon!.AttachedEnergy.length;
            const damage = inputAttack.HP! + Number(extraDamage) * energyCount;
            game.attackActivePokemon(damage);
          },
        },
        {
          pattern: /^Switch this Pokémon with 1 of your Benched Pokémon\.$/,
          transform: () => async (game: GameState) =>
            void (await game.swapActivePokemon(
              game.AttackingPlayer,
              "selfEffect"
            )),
        },
        {
          pattern: /^Flip a coin\. If tails, this attack does nothing\.$/,
          transform: () => async (game: GameState) => {
            if (game.flipCoin(game.AttackingPlayer))
              game.attackActivePokemon(inputAttack.HP!);
            else
              game.GameLog.addEntry({
                type: "attackFailed",
                player: game.AttackingPlayer.Name,
              });
          },
        },
        {
          pattern:
            /^Flip a coin\. If heads, this attack does (\d+) more damage\.$/,
          transform: (_, extraDamage) => async (game: GameState) => {
            let damage = inputAttack.HP!;
            if (game.flipCoin(game.AttackingPlayer))
              damage += Number(extraDamage);
            game.attackActivePokemon(damage);
          },
        },
        {
          pattern:
            /^Flip (\d+) coins\. This attack does (\d+) (more )?damage for each heads\.$/,
          transform:
            (_, coins, multiplier, more) => async (game: GameState) => {
              let damage = more ? inputAttack.HP ?? 0 : 0;
              const { heads } = game.flipMultiCoin(
                game.AttackingPlayer,
                Number(coins)
              );
              damage += heads * Number(multiplier);
              game.attackActivePokemon(damage);
            },
        },
        {
          pattern: /^Discard (a|\d+) \{(\w)\} Energy from this Pokémon\.$/,
          transform: (_, count, energyType) => {
            const fullType = parseEnergy(energyType);

            return async (game: GameState) => {
              await defaultEffect(game);
              game.discardEnergy(
                game.AttackingPlayer.ActivePokemon!,
                fullType,
                Number(count) || 1
              );
            };
          },
        },
        {
          pattern: /^Discard all Energy from this Pokémon\.$/,
          transform: () => async (game: GameState) => {
            await defaultEffect(game);
            game.discardAllEnergy(game.AttackingPlayer.ActivePokemon!);
          },
        },
        {
          pattern: /^This Pokémon also does (\d+) damage to itself\.$/,
          transform: (_, selfDamage) => async (game: GameState) => {
            await defaultEffect(game);
            game.applyDamage(
              game.AttackingPlayer.ActivePokemon!,
              Number(selfDamage),
              true
            );
          },
        },
        {
          pattern:
            /^Put 1 random(?: \{(\w)\})? Pokémon from your deck into your hand\.$/,
          transform: (_, type) => {
            const e = type ? parseEnergy(type) : undefined;

            const predicate = e
              ? (card: PlayingCard) =>
                  card.CardType == "Pokemon" && card.Type == e
              : (card: PlayingCard) => card.CardType == "Pokemon";

            return async (game: GameState) => {
              await defaultEffect(game);
              game.AttackingPlayer.drawRandomFiltered(predicate);
            };
          },
        },
        {
          pattern:
            /^Flip 2 coins. If both of them are heads, this attack does (\d+) more damage\.$/,
          transform: (_, extraDamage) => async (game: GameState) => {
            const { heads } = game.flipMultiCoin(game.AttackingPlayer, 2);
            let damage = inputAttack.HP ?? 0;
            if (heads == 2) damage += Number(extraDamage);
            game.attackActivePokemon(damage);
          },
        },
        {
          pattern:
            /^Discard a random Energy from your opponent's Active Pokémon.$/,
          transform: () => async (game: GameState) => {
            await defaultEffect(game);
            game.DefendingPlayer.discardRandomEnergy(
              game.DefendingPlayer.ActivePokemon!
            );
          },
        },
        {
          pattern:
            /^Flip a coin. If heads, discard a random Energy from your opponent's Active Pokémon.$/,
          transform: () => async (game: GameState) => {
            await defaultEffect(game);
            if (game.flipCoin(game.AttackingPlayer)) {
              game.DefendingPlayer.discardRandomEnergy(
                game.DefendingPlayer.ActivePokemon!
              );
            }
          },
        },
        {
          pattern:
            /^This attack also does (\d+) damage to each of your opponent's Benched Pokémon\.$/,
          transform: (_, benchDamage) => async (game: GameState) => {
            await defaultEffect(game);
            const bench = game.DefendingPlayer.Bench.filter(
              (p) => p !== undefined
            );
            for (const pokemon of bench) {
              game.attackPokemon(pokemon, Number(benchDamage));
            }
          },
        },
        {
          pattern:
            /^If your opponent's Active Pokémon has damage on it, this attack does (\d+) more damage\.$/,
          transform: (_, extraDamage) => async (game: GameState) => {
            const active = game.DefendingPlayer.ActivePokemon!;
            let damage = inputAttack.HP ?? 0;
            // TODO: need to implement a separate "MaxHP" property for capes
            if (active.CurrentHP < active.BaseHP) {
              damage += Number(extraDamage);
            }
            game.attackActivePokemon(damage);
          },
        },
        {
          pattern:
            /^If this Pokémon has damage on it, this attack does (\d+) more damage\.$/,
          transform: (_, extraDamage) => async (game: GameState) => {
            const active = game.AttackingPlayer.ActivePokemon!;
            let damage = inputAttack.HP ?? 0;
            if (active.CurrentHP < active.BaseHP) {
              damage += Number(extraDamage);
            }
            game.attackActivePokemon(damage);
          },
        },
        {
          pattern:
            /^This attack does (\d+)( more)? damage for each of your Benched(?: \{(\w)\})? (.+?)\.$/,
          transform: (_, damagePerBench, addDamage, type, pokemon) => {
            const e = type ? parseEnergy(type) : undefined;

            return async (game: GameState) => {
              const bench = game.AttackingPlayer.Bench.filter(
                (p) =>
                  p !== undefined &&
                  (!e || p.Type == e) &&
                  (pokemon == "Pokémon" || p.Name == pokemon)
              );
              const damage =
                (inputAttack.HP ?? 0) + bench.length * Number(damagePerBench);
              game.attackActivePokemon(damage);
            };
          },
        },
        {
          pattern:
            /^Flip a coin. If heads, this attack does (\d+) more damage. If tails, this Pokémon also does (\d+) damage to itself\.$/,
          transform:
            (_, extraDamage, selfDamage) => async (game: GameState) => {
              let damage = inputAttack.HP ?? 0;
              let selfDamageApplied = false;
              if (game.flipCoin(game.AttackingPlayer)) {
                damage += Number(extraDamage);
              } else {
                selfDamageApplied = true;
              }

              game.attackActivePokemon(damage);
              if (selfDamageApplied)
                game.applyDamage(
                  game.AttackingPlayer.ActivePokemon!,
                  Number(selfDamage),
                  true
                );
            },
        },
        {
          pattern:
            /^Heal from this Pokémon the same amount of damage you did to your opponent's Active Pokémon\.$/,
          transform: () => async (game: GameState) => {
            const damageDealt = game.attackActivePokemon(inputAttack.HP ?? 0);
            game.healPokemon(game.AttackingPlayer.ActivePokemon!, damageDealt);
          },
        },
        {
          pattern: /^Switch out your opponent's Active Pokémon to the Bench\./,
          transform: () => async (game: GameState) => {
            await defaultEffect(game);
            await game.swapActivePokemon(
              game.DefendingPlayer,
              "opponentEffect"
            );
          },
        },
        {
          pattern:
            /^Take (a|\d+) \{(\w)\} Energy from your Energy Zone and attach it to this Pokémon\.$/,
          transform: (_, count, type) => {
            const fullType = parseEnergy(type);

            return async (game: GameState) => {
              await defaultEffect(game);
              game.AttackingPlayer.attachEnergy(
                game.AttackingPlayer.ActivePokemon!,
                new Array(count == "a" ? 1 : Number(count)).fill(fullType),
                "energyZone"
              );
            };
          },
        },
        {
          pattern:
            /^Flip a coin. If heads, discard a random card from your opponent's hand\.$/,
          transform: () => async (game: GameState) => {
            await defaultEffect(game);
            if (game.flipCoin(game.AttackingPlayer)) {
              game.DefendingPlayer.discardRandomFiltered();
            }
          },
        },
        {
          pattern:
            /^Flip a coin until you get tails\. This attack does (\d+)(?: more)? damage for each heads\.$/,
          transform: (_, damage) => async (game: GameState) => {
            let totalDamage = inputAttack.HP ?? 0;
            while (game.flipCoin(game.AttackingPlayer)) {
              totalDamage += Number(damage);
            }
            game.attackActivePokemon(totalDamage);
          },
        },
        {
          pattern:
            /^1 of your opponent's Pokémon is chosen at random (\d+) times\. For each time a Pokémon was chosen, do (\d+) damage to it\.$/,
          transform: (_, times, damage) => async (game: GameState) => {
            const damages = game.DefendingPlayer.InPlayPokemon.map(() => 0);
            for (let i = 0; i < Number(times); i++) {
              damages[Math.floor(Math.random() * damages.length)] +=
                Number(damage);
            }
            for (let i = 0; i < damages.length; i++) {
              if (damages[i] > 0) {
                game.attackPokemon(
                  game.DefendingPlayer.InPlayPokemon[i],
                  damages[i]
                );
              }
            }
          },
        },
        {
          pattern:
            /^Take a \{(\w)\} Energy from your Energy Zone and attach it to 1 of your( Benched)?(?: \{(\w)\})? Pokémon\.$/,
          transform: (energyType, benched, pokemonType) => {
            const et = parseEnergy(energyType);
            const pt = pokemonType ? parseEnergy(pokemonType) : undefined;

            return async (game: GameState) => {
              const validPokemon = game.AttackingPlayer.InPlayPokemon.filter(
                (x) =>
                  (!benched || x != game.AttackingPlayer.ActivePokemon) &&
                  (!pt || x.Type == pt)
              );
              const pokemon = await game.choosePokemon(
                game.AttackingPlayer,
                validPokemon
              );
              if (pokemon) {
                game.AttackingPlayer.attachEnergy(pokemon, [et], "energyZone");
              }
            };
          },
        },
        {
          pattern:
            /^This attack does (\d+) damage to 1 of your opponent's( Benched)? Pokémon\.$/,
          transform: (_, damage, benched) => async (game: GameState) => {
            const pokemon = await game.choosePokemon(
              game.AttackingPlayer,
              game.DefendingPlayer.InPlayPokemon.filter(
                (p) => !benched || p !== game.DefendingPlayer.ActivePokemon
              )
            );
            if (pokemon) {
              game.attackPokemon(pokemon, Number(damage));
            }
          },
        },
        {
          pattern:
            /^This attack also does (\d+) damage to 1 of your Benched Pokémon\.$/,
          transform: (_, damage) => async (game: GameState) => {
            await defaultEffect(game);
            const pokemon = await game.choosePokemon(
              game.AttackingPlayer,
              game.AttackingPlayer.Bench.filter((p) => p !== undefined)
            );
            if (pokemon) {
              game.attackPokemon(pokemon, Number(damage));
            }
          },
        },
      ];

      for (const { pattern, transform } of dictionary) {
        const result = inputAttack.Effect.match(pattern);

        if (result) {
          const Effect = transform(...result);
          return {
            parseSuccessful,
            value: { Name, RequiredEnergy, Effect },
          };
        }
      }

      const damaging = !!inputAttack.HP;
      const Effect = async (game: GameState) => {
        if (damaging) await defaultEffect(game);
        game.GameLog.addEntry({
          type: "actionFailed",
          player: game.AttackingPlayer.Name,
          reason: damaging ? "partiallyImplemented" : "notImplemented",
        });
      };
      return {
        parseSuccessful: false,
        value: { Name, RequiredEnergy, Effect },
      };
    }

    return {
      parseSuccessful,
      value: { Name, RequiredEnergy, Effect: defaultEffect },
    };
  };

  const parseAbility = (
    inputAbility: InputCardAbility
  ): ParsedResult<Ability> => {
    return {
      parseSuccessful: false,
      value: {
        Name: inputAbility.Name,
        Trigger: "GameRule",
        Conditions: [],
        Effect: async () => {},
      },
    };
  };

  const parseTrainerEffect = (cardText: string): ParsedResult<Effect> => {
    const dictionary: EffectTransformer[] = [
      {
        pattern: /^Draw (a|\d+) cards?\.$/,
        transform: (_, count) => async (game: GameState) =>
          game.drawCards(count == "a" ? 1 : Number(count)),
      },
      {
        pattern: /^Put 1 random Basic Pokemon from your deck into your hand\.$/,
        transform: () => async (game: GameState) =>
          game.AttackingPlayer.drawRandomFiltered(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          ),
      },
      {
        pattern: /^Switch out your opponent's Active Pokémon to the Bench\./,
        transform: () => async (game: GameState) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
        },
      },
      {
        pattern:
          /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
        transform: (_, modifier) => async (game: GameState) => {
          game.reduceRetreatCost(Number(modifier));
        },
      },
      {
        pattern:
          /^During this turn, attacks used by your Pokémon do \+(\d+) damage to your opponent's Active Pokémon\.$/,
        transform: (_, modifier) => async (game: GameState) => {
          game.increaseAttackModifier(Number(modifier));
        },
      },
      {
        pattern:
          /^During your opponent's next turn, all of your Pokémon take −(\d+) damage from attacks from your opponent's Pokémon\.$/,
        transform: (_, modifier) => async (game: GameState) => {
          game.increaseDefenseModifier(Number(modifier));
        },
      },
      {
        pattern: /^Heal (\d+) damage from 1 of your (?:\{(\w)\} )?Pokémon\.$/,
        transform: (_, modifier, type) => async (game: GameState) => {
          let validPokemon = game.AttackingPlayer.InPlayPokemon.filter(
            (x) => x.CurrentHP < x.BaseHP
          );
          if (isEnergyShort(type))
            validPokemon = validPokemon.filter(
              (x) => x.Type == EnergyMap[type]
            );
          const pokemon = await game.choosePokemon(
            game.AttackingPlayer,
            validPokemon
          );
          if (pokemon) game.healPokemon(pokemon, Number(modifier));
        },
      },
      {
        pattern:
          /^Choose 1 of your {(\w)} Pokémon, and flip a coin until you get tails\. For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/,
        transform: (_, pokemonType, energyType) => {
          const pt = parseEnergy(pokemonType);
          const et = parseEnergy(energyType);

          return async (game: GameState) => {
            const validPokemon = game.AttackingPlayer.InPlayPokemon.filter(
              (x) => x.Type == pt
            );
            const pokemon = await game.choosePokemon(
              game.AttackingPlayer,
              validPokemon
            );
            if (pokemon) {
              const { heads } = game.flipCoinUntilTails(game.AttackingPlayer);
              game.AttackingPlayer.attachEnergy(
                pokemon,
                new Array(heads).fill(et),
                "energyZone"
              );
            }
          };
        },
      },
      {
        pattern: /^Put your (.+?) in the Active Spot into your hand\.$/,
        transform: (_, pokemon) => {
          const names = parsePokemonNames(pokemon);

          return async (game: GameState) => {
            const active = game.AttackingPlayer.ActivePokemon;
            if (active && names.includes(active.Name)) {
              game.AttackingPlayer.returnPokemonToHand(active);
            } else {
              game.GameLog.addEntry({
                type: "actionFailed",
                player: game.AttackingPlayer.Name,
                reason: "noValidTargets",
              });
            }
          };
        },
      },
      {
        pattern:
          /^Take a {(\w)} Energy from your Energy Zone and attach it to (.+?)\.$/,
        transform: (_, energyType, pokemon) => {
          const fullType = parseEnergy(energyType);
          const names = parsePokemonNames(pokemon);

          return async (game: GameState) => {
            const validPokemon = game.AttackingPlayer.InPlayPokemon.filter(
              (x) => names.includes(x.Name)
            );
            if (validPokemon.length > 0) {
              const pokemon = await game.choosePokemon(
                game.AttackingPlayer,
                validPokemon
              );
              if (pokemon) {
                game.AttackingPlayer.attachEnergy(
                  pokemon,
                  [fullType],
                  "energyZone"
                );
              }
            } else {
              game.GameLog.addEntry({
                type: "actionFailed",
                player: game.AttackingPlayer.Name,
                reason: "noValidTargets",
              });
            }
          };
        },
      },
      {
        pattern:
          /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/,
        transform: (_, energyType, pokemonNames) => {
          if (!isEnergyShort(energyType))
            throw new Error("Unrecognized energy shorthand: " + energyType);

          const fullType = EnergyMap[energyType];
          const names = parsePokemonNames(pokemonNames);
          console.log("Parsed names:", names);
          return async (game: GameState) => {
            if (!names.includes(game.AttackingPlayer.ActivePokemon!.Name)) {
              game.GameLog.addEntry({
                type: "actionFailed",
                player: game.AttackingPlayer.Name,
                reason: "noValidTargets",
              });
              return;
            }
            for (const pokemon of game.AttackingPlayer.Bench) {
              if (!pokemon) continue;
              const energyToMove = pokemon.AttachedEnergy.filter(
                (e) => e == fullType
              );
              if (energyToMove.length > 0) {
                game.AttackingPlayer.transferEnergy(
                  pokemon,
                  game.AttackingPlayer.ActivePokemon!,
                  energyToMove
                );
              }
            }
          };
        },
      },
    ];

    for (const { pattern, transform } of dictionary) {
      const result = cardText.match(pattern);

      if (result) {
        return {
          parseSuccessful: true,
          value: transform(...result),
        };
      }
    }

    return {
      parseSuccessful: false,
      value: async (game: GameState) => {
        game.GameLog.addEntry({
          type: "actionFailed",
          player: game.AttackingPlayer.Name,
          reason: "notImplemented",
        });
      },
    };
  };

  const parsePokemonNames = (nameString: string) => {
    return nameString.split(/, or | or |, /);
  };

  return { parseCard, parseAttack, parseAbility, parseTrainerEffect };
};
