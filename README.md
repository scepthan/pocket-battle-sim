# pocket-battle-sim

Backend todo:

- [x] Parse cards
  - [x] A1: 226/226 (100%)
  - [x] A1a: 68/68 (100%)
    - [x] Put opponent mon from Discard back onto Bench
    - [x] Copy attack without energy requirement
    - [x] Extra damage if ex
    - [x] Redraw hand to opponent's hand size
    - [x] Extra damage if mon knocked out from attack
    - [x] Extra damage per opponent's Benched mon
    - [x] Discard random Energy from among field
    - [x] Ability to move Energy between mon
    - [x] Heal all mon
    - [x] Draw mon if on top of deck
    - [x] Evolution-blocking Ability
    - [x] Coin flip to attack effect
    - [x] Energy-doubling Ability
    - [x] Discard energy and attack any mon
  - [ ] A2: 89/157 (56.7%)
    - [x] Pokémon Tools
    - [ ] Confused
      - [ ] Promo Misdreavus
    - [ ] Burned
    - [ ] Ability activation on energy attach
      - [ ] Promo Cresselia ex
    - [x] Attack effect based on whether Tool attached
    - [x] Bring in opponent's damaged Benched mon
  - [ ] A2a
  - [ ] A2b
  - [ ] A3
  - [ ] A3a
    - [ ] Ultra Beasts
  - [ ] A3b
  - [ ] A4
    - [ ] Baby Pokémon (0-cost attacks)
  - [ ] A4a
- [ ] Bring in newer sets
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
  - [x] A1a official
  - [x] A1a unofficial
