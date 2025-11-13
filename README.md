# pocket-battle-sim

Backend todo:

- [x] Parse cards
  - [x] A1: 237/237 (100%)
  - [x] A1a: 70/70 (100%)
  - [x] A2: 157/157 (100%)
  - [x] A2a: 77/77 (100%)
  - [ ] A2b: 73/73 (100%)
    - [x] Abilities
      - [x] New effects
        - [x] Active mon has no retreat cost
        - [x] Generate energy and end turn
        - [x] Flip to poison
        - [x] Heal active mon
    - [x] Attacks
      - [x] New predicates
        - [x] Mon with energy attached
      - [x] New effects
        - [x] Attack one of opponent's mon at random
    - [x] Trainers
      - [x] Each player redraws hand
      - [x] Heal and remove special conditions
      - [x] Extra damage to Pokemon ex
      - [x] Flip until tails to discard energy
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
