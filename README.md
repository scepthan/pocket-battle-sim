# pocket-battle-sim

Backend todo:

- [x] Parse cards
  - [x] A1: 237/237 (100%)
  - [x] A1a: 70/70 (100%)
  - [x] A2: 157/157 (100%)
  - [x] A2a: 77/77 (100%)
  - [x] A2b: 73/73 (100%)
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
  - [ ] Evolve multiple mon per turn
  - [ ] Avoid putting down multiple of the same mon if others are available
  - [ ] Properly calculate energy costs for attacking
  - [ ] Why is the bot not switching into mon that are ready to attack?
- [x] Mass battle simulation
- [ ] Deck fine-tuning via iteration

Frontend todo:

- [x] Battle simulation UI (~90%)
  - [ ] Collapse energy icons when at 5 or more
  - [ ] Display game points somewhere
  - [x] Display discard somewhere
  - [x] Display deck size and opponent hand size
  - [x] Display attached Pokemon Tools
  - [ ] Display statuses and Special Conditions
- [x] Allow user to select decks for arena
- [x] Allow user control of one or both players in arena
- [ ] Allow user to select set of decks to run in mass simulator
- [x] Deck list UI
  - [x] Custom and built-in decks
  - [x] Show cards and energy types in deck
- [x] Deck builder UI
  - [x] Display cards currently in deck
  - [x] Display count on card and allow +/-/x
  - [x] Allow energy selection
  - [x] Add ability to save decks and edit existing decks
  - [x] Advanced search filters
