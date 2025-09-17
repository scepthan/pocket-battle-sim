# pocket-battle-sim

Backend todo:

- [x] Parse cards
  - [x] A1: 226/226 (100%)
    - [x] Dragon type
    - [x] Conditions
      - [x] Special Conditions
        - [x] Asleep
        - [x] Paralyzed
        - [x] Poisoned
      - [x] Other active mon conditions
      - [x] Global conditions
    - [x] Fossils
    - [x] Abilities
      - [x] Once during your turn
      - [x] As often as you like during your turn
      - [x] Damage reduction
      - [x] Attack retaliation
    - [x] Misty
    - [x] Supporters that affect specific mon
    - [x] Choose a mon to attack
    - [x] Shuffle mon into deck
    - [x] Viewing own deck or opponent's cards
    - [x] Draw mon onto Bench
    - [x] Distribute energy among Benched mon
    - [x] Use opposing mon's attack
  - [ ] A1a: 55/68 (80.8%)
    - [x] Put opponent mon from Discard back onto Bench
    - [x] Copy attack without energy requirement
    - [ ] Energy-doubling Ability
    - [ ] Rework how multi-effect attacks are parsed (e.g. Volcarona)
    - [ ] Discard random Energy
    - [ ] Ability to move Energy between mon
    - [ ] Evolution-blocking Ability
    - [ ] Extra damage if mon knocked out from attack
    - [ ] Coin flip to attack effect
    - [ ] Extra damage per opponent's Benched mon
    - [ ] Extra damage if ex
    - [ ] Redraw hand
    - [ ] Draw mon if on top of deck
  - [ ] A2
    - [ ] Confused
    - [ ] Burned
    - [ ] Pokémon Tools
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
  - [ ] Display discard somewhere
  - [ ] Display deck size and opponent hand size
  - [ ] Display statuses and Special Conditions
- [ ] Allow user control of one or both players in battle simulator
- [ ] Deck builder UI
  - [ ] Display cards currently in deck
  - [ ] Display count on card and allow +/-/x
  - [ ] Add ability to save decks and edit existing decks

Other todo:

- [x] Deck library
  - [x] A1 official
  - [x] A1 unofficial
  - [ ] A1a official
  - [ ] A1a unofficial
