# pocket-battle-sim

Backend todo:

- [x] Parse cards
  - [x] A1: 237/237 (100%)
  - [x] A1a: 70/70 (100%)
  - [x] A2: 157/157 (100.0%)
  - [ ] A2a: 63/76 (82.9%)
    - [ ] Abilities
      - [x] New conditional: specific mon in play (Arceus Link)
      - [ ] New trigger: between turns
      - [ ] New mon status
        - [ ] Reduce cost of own attacks
        - [x] Increase own attack damage
        - [ ] Prevent Special Conditions
      - [ ] New player status
        - [ ] Reduce retreat cost
      - [ ] New effect
        - [ ] Attach energy to mon
        - [ ] Choose player, look at top card of deck
    - [ ] Attacks
      - [ ] Shuffle random card from opponent's hand into deck
      - [x] Poisoned+
      - [x] Discard N random energy
      - [ ] Make self Asleep
      - [ ] Prevent attack damage next turn (Promo Nosepass)
    - [ ] Trainers
      - [ ] Heal damage from mon with specific energy attached
      - [ ] Return random mon from discard to hand
      - [ ] Reduce attack cost for specific mon
      - [ ] Reduce damage done to mon of type
  - [ ] A2b
  - [ ] A3
  - [ ] A3a
    - [ ] Ultra Beasts
  - [ ] A3b
  - [ ] A4
    - [ ] Baby Pokémon (0-cost attacks)
  - [ ] A4a
- [x] Bring in newer sets
- [x] Single battle simulation
- [ ] Basic logic-based AI opponent (at least as competitive as Auto Mode)
- [x] Mass battle simulation
- [ ] Deck fine-tuning via iteration

Frontend todo:

- [x] Battle simulator UI (~90%)
  - [ ] Collapse energy icons when at 5 or more
  - [ ] Display game points somewhere
  - [x] Display discard somewhere
  - [x] Display deck size and opponent hand size
  - [x] Display attached Pokemon Tools
  - [ ] Display statuses and Special Conditions
- [ ] Allow user control of one or both players in battle simulator
- [ ] Deck builder UI
  - [x] Display cards currently in deck
  - [x] Display count on card and allow +/-/x
  - [x] Allow energy selection
  - [ ] Add ability to save decks and edit existing decks

Other todo:

- [x] Deck library
  - [x] A1 official
  - [x] A1 unofficial
  - [x] A1 meta
  - [x] A1a official
  - [x] A1a unofficial
  - [ ] A1a meta
  - [ ] A2 official
  - [ ] A2 unofficial
  - [ ] A2 meta
