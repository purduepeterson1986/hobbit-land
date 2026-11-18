# Hobbit Land

A board game for 2 to 4 players, played in any web browser on a computer or an iPad. Carry the Ring along the road from Bag End in the Shire to Mount Doom in Mordor.

## How to play

1. Choose the number of players. Each player picks one of the four hobbits (Frodo, Sam, Merry or Pippin) and is played by a **Person** or the **Computer**. Press **Start game**.
2. On your turn, press **Roll** (or tap the die, or press the space bar). Your hobbit walks that many spaces.
3. If you stop on a **card space** (gold, with a little card on it), a card is turned over for everyone to read. It says to move forward, move back, or stay where you are. Press **Continue** and your hobbit makes that move. That second move never turns over another card.
4. If you stop **exactly** on a **fork** (green, with a signpost), your next move takes the shortcut. Pass a fork without stopping on it and you stay on the long road.
5. If you stop on a **resting place** (Bree, Rivendell or Lothlórien, shown with a green leaf), you get **+1 on your next roll**. A leaf "+1" badge shows on your name tag until you use it. Bonuses do not stack.
6. About one card in fifteen is a **rare card**:
   - **The Eagles carry you 5 spaces.** Your hobbit flies there, carried by an eagle.
   - **Swap places with another hobbit.** You trade places with another hobbit still on the road, chosen at random.
   - **Gollum steals your next turn.** A "Skip" badge shows on your name tag until that turn is missed.
7. The first hobbit to reach Mount Doom wins. Play goes on until every place (2nd, 3rd, 4th) is decided.

## The road

- Each game uses one of three maps, picked at random: **Eriador**, **Serpent** (the road zig-zags across the map) or **Ithilien** (the road runs south first). The road is drawn differently on each, but every map has the same places, forks, resting places and number of spaces.
- **Buckleberry Ferry:** a shortcut across the Brandywine, starting at Farmer Maggot's and rejoining the road at Bree.
- **Mines of Moria:** a shortcut under the Misty Mountains, starting at the Doors of Durin and rejoining the road at Lothlórien.
- Along the way: Bree, Weathertop, Rivendell, Lothlórien, Amon Hen, the Emyn Muil, the Dead Marshes, Ithilien, Minas Morgul and Cirith Ungol.
- Reaching Mount Doom does not need an exact roll.
- **Road length** (chosen in settings), the same on all three maps:

  | Length | Spaces (long way) | With both shortcuts | Difference |
  |---|---|---|---|
  | Short | 74 | 60 | Skips the Emyn Muil and the Dead Marshes |
  | Normal | 85 | 71 | |
  | Long | 100 | 86 | A long loop out to the Dead Marshes |

## Every game is different

- About 35% of the ordinary spaces are card spaces, chosen at random each game. There are never more than 4 card spaces, or 5 blank spaces, in a row on any way through the map (forks and resting places don't count).
- Each card is made up when it is turned over: forward, back or stay, and how many spaces.
- The scenery is rearranged each game: trees, rocks, sheep, horses, clouds and birds move around, and the season (spring, summer or autumn) and time of day (morning, midday or evening) change.
- During play, flocks of birds now and then fly across the map.
- **Visitors** (just for show): every few turns one may appear. Gollum peeks out from behind a rock near the leading hobbit; Gandalf's cart rolls through the Shire letting off fireworks; a great eagle glides over the Misty Mountains; a Black Rider gallops past; an Ent wakes in Fangorn and takes a few steps; a flock of crebain sweeps low across the map; Tom Bombadil skips by in his yellow boots; a Nazgûl on a winged beast circles over Mordor; Shadowfax gallops across open ground. Visitors that walk or ride always cross where there is no road.
- **Passers-by** (just for show): every half minute or so, a small group crosses the open ground above the Hobbit Land title on the map: a Nazgûl rider, a band of orcs, two elves, Gandalf on foot, a hobbit leading a pony, two dwarves, or a pack of wargs.
- **Weather** (just for show) comes and goes: a rain cloud drifting somewhere over the map, mist over the Dead Marshes, or snow on Caradhras. Silent lightning flickers now and then behind Barad-dûr, and on evening games a shooting star sometimes crosses the sky.
- **Living places** (just for show): chimneys smoke at Bag End, Farmer Maggot's and Bree, and windows glow on evening games; soft lights drift among the trees of Lothlórien; Minas Morgul's green light pulses; the Doors of Durin light up when a hobbit stops there; the Eye of Sauron turns to watch the hobbit closest to Mount Doom.
- **Little reactions** (just for show): sheep and horses trot out of the way when a hobbit passes; moths circle a hobbit who has rested until the +1 is used; a hobbit left standing a long time sits down for a rest or eats an apple.
- **Celebrations:** fireworks when a hobbit finds a shortcut. When a hobbit reaches Mount Doom, the volcano erupts, the Free Peoples (hobbits, dwarves, elves, men and Gandalf) fade in above the Hobbit Land title and dance, and an eagle flies from Farmer Maggot's to Mount Doom and carries the hobbit home to Bag End. The dancers fade away when he is set down.

## Settings

- **Players:** 2, 3 or 4, each a Person or the Computer. Picking a hobbit another player already has swaps the two.
- **Road length:** Short, Normal or Long (see the table above).
- **Map:** chosen at random each game from three layouts: Eriador (the road described above), Serpent (a zig-zag road across the map) or Ithilien (a road that runs south first). They share the same stops, forks, rest stops and lengths. The start message says which map is in play.
- **Auto-tap Computer Cards:** off by default, so a card on a computer's turn waits for someone to press Continue. Turn it **On** and choose how long each card stays up (2, 5 or 10 seconds) before Continue is tapped automatically. This applies to computer players only; people always press Continue themselves.
- Settings are remembered between visits. Win counts are kept while you press **Next game**, and start again when you go back to the settings.

## Changing the cards

`cards.js` makes the cards. Near the top of the file:

- `KIND_WEIGHTS` sets how often forward, back and stay cards appear.
- `SPECIAL_CHANCE` and `SPECIALS` set how often a rare card appears, and which ones.
- `STEP_WEIGHTS` sets how often a card moves 1, 2 or 3 spaces.
- `PHRASES` holds Lord of the Rings sentences for each kind of card (forward, back, stay, and one list each for the rare cards). One sentence is picked at random and shown above the result (for example "Move forward 2 spaces"). Add sentences to a list and they will appear on cards of that kind.

## How long a game takes

From 10,000 simulated two-player games on each road:

| Road | Winner's turns (average) | Whole game, both players (average) |
|---|---|---|
| Short | 18 (usually 15–21) | 35 turns |
| Normal | 21 (usually 18–24) | 41 turns |
| Long | 25 (usually 22–28) | 49 turns |

That is roughly 5–6 minutes for a two-player game on the Normal road.

## Running it yourself

No installation or build step is needed. Serve the folder with any web server, or open `index.html` in a browser. The title font loads from Google Fonts when online; without it, a built-in serif font is used.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page |
| `styles.css` | Appearance and animations |
| `game.js` | Settings, turns, dice, cards on screen, token movement, sound |
| `board.js` | The road, the spaces, the shortcuts and the map drawing |
| `cards.js` | Makes a random card each time one is turned over |
| `hobbits.js` | The four hobbits: colours, board token and portrait |
| `manifest.json`, `icon-192.png`, `icon-512.png` | Lets the game be installed as an app |
