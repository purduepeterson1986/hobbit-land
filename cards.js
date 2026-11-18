/* Hobbit Land — the cards a player turns over when they land on a card space.
 *
 * Every card is made up fresh when it is drawn:
 *   1. pick what kind of card it is (forward, back or stay) using KIND_WEIGHTS;
 *   2. pick how many spaces to move using STEP_WEIGHTS;
 *   3. pick a Lord of the Rings sentence for that kind of card.
 *
 * About 1 card in 15 is a rare SPECIAL card instead (see SPECIALS below).
 *
 * The sentence is chosen last, so it never changes what the card does.
 * PHRASES are general sentences that fit anywhere on the road.
 * PLACES are sentences that name a place; each one only turns up in the part of the
 * road where it makes sense (see AREAS). When a hobbit is somewhere with place
 * sentences of the right kind, PLACE_CHANCE of the cards use one of those.
 * Write a sentence without the move; the game adds the move underneath it.
 */
(function () {
  'use strict';

  // How often each kind of card turns up (the numbers are relative, not percentages).
  const KIND_WEIGHTS = { forward: 45, back: 30, stay: 25 };

  // How many spaces a forward or back card moves: 1 is most likely, 3 is rare.
  const STEP_WEIGHTS = { 1: 5, 2: 3, 3: 2 };

  // Rare special cards. SPECIAL_CHANCE is how often one turns up instead of an ordinary card.
  //   eagles: fly forward 5 spaces (shortcuts still need a start on the fork)
  //   swap:   swap places with another hobbit still on the road, chosen at random
  //   skip:   Gollum steals your next turn
  const SPECIAL_CHANCE = 1 / 15;
  const SPECIALS = [
    { special: 'eagles', weight: 1, move: 5, text: 'The Eagles carry you 5 spaces' },
    { special: 'swap', weight: 1, move: 0, text: 'Swap places with another hobbit' },
    { special: 'skip', weight: 1, move: 0, text: 'Gollum steals your next turn' }
  ];

  // How often a card uses a sentence about the place the hobbit is in (when there is one).
  const PLACE_CHANCE = 0.4;

  // General sentences: they fit anywhere on the road. One is picked at random for each card.
  const PHRASES = {
    forward: [
      'A friendly Rohan horse gives you a lift along the road.',
      'Sam finds a fresh loaf and a wheel of cheese in your pack.',
      'Gwaihir the Windlord swoops low and nudges you onward.',
      'Strider points out a short cut through the trees.',
      'Gandalf\'s fireworks light up the path ahead.',
      'Legolas spots the way ahead and waves you on.',
      'Bilbo\'s old song puts a spring in your step.',
      'The Ring hums softly, and the road seems shorter today.',
      'A cheerful Ent carries you a few strides on his shoulder.',
      'You hear Gimli laughing up ahead, and you hurry to catch up.',
      'A passing Dúnadan shows you a hidden path.',
      'Radagast the Brown guides your steps with a birdcall.',
      'The sun breaks through the clouds, and your heart lifts.',
      'Merry and Pippin cheer you on from the roadside.',
      'A herd of ponies from the Riddermark trots past, and you ride along.',
      'A rabbit leads you along a sheltered track through the hedges.',
      'Aragorn offers you a steady hand over the rocks.',
      'The eagles of the Misty Mountains watch over you and wave you on.',
      'A fellow traveller shares a song and a shortcut.',
      'Your pack feels lighter, and you walk with a spring in your step.',
      'The hills fall away, and the road runs smooth and easy.',
      'Bilbo\'s birthday gifts turn up on the road, and your luck is high.',
      'The Riders of Rohan cheer as they pass, and you join in and hurry on.',
      'Treebeard\'s tree-herds part for you, and the path opens wide.',
      'The stars of Varda shine brightly, and you walk by their light.',
      'Sam sings a song about gardens, and you march to the rhythm.',
      'An eagle feather drifts down at your feet, and hope rises in your chest.',
      'Horns echo over the hills, and the road opens before you.',
      'Gimli wagers you cannot reach the next milestone before supper, and you race to prove him wrong.',
      'A band of Rangers lifts you onto a horse and gallops off with you.',
      'A pack pony trots up, carrying nothing but good cheer.',
      'The Lord of the Eagles hears your call and sends a friendly wind.',
      'A cask of the Old Took\'s finest ale is waiting at the next inn.',
      'Sméagol is nowhere to be seen, and the road is blissfully clear.',
      'A spring of clear water makes the road feel fresh again.',
      'The Dwarves of Erebor sing a marching song, and you march along beside them.',
      'A friendly dog trots beside you and leads you to a better path.',
      'You find a walking stick that is just the right size.',
      'A merry tune on a tin whistle puts a skip in your step.',
      'The road runs downhill, and you trot along at a good pace.',
      'A kind stranger shares a map with a quicker way marked on it.',
      'Gandalf taps the road with his staff, and the way seems clear.',
      'A good night\'s sleep leaves you fresh and ready to go.',
      'Sam packs the bags extra fast this morning.',
      'Pippin chases a runaway apple and finds a shortcut.',
      'A squirrel chatters and shows you a path through the trees.',
      'The fog lifts, and you can see the road for miles.',
      'A warm breakfast of bacon and eggs gets you going early.'
    ],
    back: [
      'A bridge has washed out, and you must find another way round.',
      'A Nazgûl\'s shadow glides overhead, and you duck into a ditch.',
      'A tangle of brambles blocks the path, and you must retreat.',
      'Your boot pinches, and you turn back to fetch a spare.',
      'A sudden storm drives you off the road.',
      'Gollum\'s footprints lead you down the wrong track.',
      'A pack of wolves howls in the hills, and you fall back.',
      'A fallen tree bars the road, and you must go back round it.',
      'Rain has smudged your map, and you lose the way.',
      'Orcs hold the pass, and you slip back into the shadows.',
      'A loose stone turns under your foot, and you slide down the slope.',
      'The river is in flood, and you wait on the bank before going on.',
      'You stop to help a lost Shire hobbit and are led back a little way.',
      'A cloud of crows bursts from the field and drives you back.',
      'The Ring grows heavy, and you sink back to rest.',
      'Sauron\'s eye sweeps the land, and you shrink from its gaze.',
      'Frodo\'s old wound aches, and you turn back to the last camp.',
      'A stream floods the track, and you wade back to the bank.',
      'A cart is stuck in the mud, and you help heave it free before going on.',
      'A hidden snare snaps shut, and you backtrack to a safer road.',
      'You left your cloak at the last inn and must turn back for it.',
      'Ringwraiths ride the road ahead, and you take cover in a hollow.',
      'Night falls early, and you must turn back to find shelter.',
      'A rockslide buries the trail, and you retrace your steps.',
      'Boromir\'s horn sounds in the distance, and you hurry back to the company.',
      'A pack of wargs howls from the hill, and you slink back into the shadows.',
      'Ents stand across the road in deep discussion, so you wait, then go back.',
      'A gust of wind snatches your hat, and you chase it back along the road.',
      'A spider\'s web stretches across the path, and you stumble back out of it.',
      'Your pony bolts, and you must chase it back along the road.',
      'A goblin\'s arrow whistles past, and you dive back behind the rocks.',
      'Heavy rain turns the track to mud, and you slip back down the hill.',
      'A hungry wolf blocks the path, and you retreat to a safer road.',
      'Your lantern flickers out, and you grope your way back to the last signpost.',
      'The Witch-king\'s horn sounds, and you turn tail and run.',
      'A sudden fall of rocks forces you to clamber back down the slope.',
      'The road ahead is blocked by a fallen oak, so you circle back the way you came.',
      'A gang of orcs spots you, and you slip away down the hill.',
      'Thorny brambles tear at your cloak, and you retreat to find another way.',
      'A sudden fog hides the path, and you wait it out by going back a little.',
      'A rotten plank gives way beneath you, and you scramble back to dry ground.',
      'A fierce gale knocks you off balance, and you stagger back a few steps.',
      'You drop your pipe and go back to look for it.',
      'Pippin wanders off after a butterfly, and you go back to find him.',
      'You trip over a root and roll back down the bank.',
      'Sam forgot his cooking pots, so you go back for them.',
      'A grumpy goat blocks the way and chases you back.',
      'Someone has turned the signpost around, and you walk the wrong way.',
      'A crow steals your lunch, and you chase it back down the road.',
      'Your pack strap breaks, and you go back to pick up what fell out.'
    ],
    stay: [
      'Pippin asks for second breakfast, and the company stops to eat.',
      'A brief rest by a clear stream. Nothing much happens today.',
      'The Ring grows heavy, and you sit down to catch your breath.',
      'You stop to tie a loose bootlace, and the road waits for you.',
      'A kind innkeeper offers a warm bed for the night.',
      'Sam is washing the pots, so you wait for him to finish.',
      'A flock of sheep crosses the road, and you pause to let them pass.',
      'A soft rain falls, and you wait under the trees for it to ease.',
      'The company sings the Lay of Lúthien by the fire.',
      'Your pony needs its hooves seen to, and you rest while it does.',
      'A quiet moment under the old trees. Time seems to stand still.',
      'You sit on a mossy stone and watch the clouds drift by.',
      'The company has lost the trail and must wait for morning.',
      'Gandalf writes a letter, and you wait for him to finish.',
      'The Ring is hidden, and you lie low until the danger passes.',
      'Frodo sits quietly by the fire and remembers home.',
      'The horses are tired, and the company makes camp.',
      'You help a family of badgers find their way home, and the road can wait.',
      'The elves sing softly, and you rest in their company.',
      'A moth circles your lantern, and you watch it for a while.',
      'You share a pipe with Merry, and the road can wait a little longer.',
      'The wind drops, and the air is still and warm.',
      'You finish sketching a map of the road, and pause to admire it.',
      'The dwarves of Erebor settle down for a long lunch, and you join them.',
      'Strider cooks a fine stew, and you wait for it to be ready.',
      'A bird sings from the branch above, and you stop to listen.',
      'Frodo writes in his book by the fire, and you wait to see what he writes.',
      'The horses need water, so you wait at the trough.',
      'Pippin wants a longer nap, and you rest with him.',
      'You stop to admire the mountain view, and the road waits for you.',
      'Sam picks blackberries by the hedge, and you help him fill the basket.',
      'Merry tells a long story about his grandfather, and you listen to the end.',
      'A traveller tells of the harvest in the Shire, and you stop to hear more.',
      'A gentle breeze carries the scent of bread from a nearby farm, and you pause to enjoy it.',
      'You wait while Frodo tends to a sore hand from the cold.',
      'A little owl hoots from the hollow, and you stop to listen.',
      'Sam looks for his lost spade, and you wait to help him find it.',
      'You sit by the road and share a bite of food with a passing pilgrim.',
      'A group of children chases butterflies across the road, and you stop to watch.',
      'The wise old Gandalf is deep in thought, and you wait for him to speak.',
      'A cool shade under a great beech tree is too tempting to leave.',
      'You stop to mend a torn strap on your pack.',
      'The company gathers around a warm campfire to share stories of the Shire.',
      'A patch of wild strawberries is too tempting to pass, so you stop to pick them.',
      'A traveller offers you a warm blanket, and you rest a while.',
      'You stop for elevenses, because hobbits always do.',
      'Sam talks about the garden back home, and you listen with a smile.',
      'A frog sits in the middle of the road, and you wait for it to hop away.',
      'You find a sunny spot and have a little nap.',
      'Gandalf blows smoke rings, and you count them as they drift away.',
      'Your feet need a rest, so you sit and wiggle your toes.',
      'A hedgehog snuffles across the path, and you wait for it to pass.'
    ],
    // the rare cards (any place on the road)
    eagles: [
      'Gwaihir and his brothers swoop down and lift you high into the air.',
      'The Great Eagles of the Misty Mountains answer your call for help.',
      'An eagle catches your cloak in its talons and carries you off.',
      'Gwaihir answers your cry, and his mighty wings lift you high over the land.',
      'A great eagle banks low over the road and snatches you up in its talons.',
      'The eagles of Thorondor come to your aid, and you soar ahead over the hills.'
    ],
    swap: [
      'Tom Bombadil laughs and trades places with you.',
      'A hobbit family swaps places with you on the road.',
      'Sméagol switches places with you while you are not looking.',
      'A wandering Ent swaps places with you, and you find yourself somewhere new.',
      'Gollum tricks you into trading places, and you hurry to keep up.',
      'You meet a fellow traveller on the road and swap places with them.'
    ],
    skip: [
      'Gollum creeps up and steals your turn.',
      'Gollum hides under a rock and takes your turn from you.',
      'Gollum poses a riddle, and you lose the next turn while you puzzle it out.',
      'Gollum slips out of the shadows and takes your turn away.',
      'Sméagol whispers a riddle, and you lose your turn while you puzzle it out.',
      'Gollum sneaks up on you while you rest, and your turn is taken.'
    ]
  };

  // Where each group of place sentences can turn up. A hobbit's place is the stop the road
  // ahead of them leads to (standing on a stop counts as that stop), or 'ferry' / 'moria'
  // on those shortcuts. The stops in order: bagend, maggot, bree, weathertop, rivendell,
  // durin, lorien, amonhen, emynmuil, marshes, ithilien, morgul, ungol, doom.
  const AREAS = {
    shire: ['bagend', 'maggot'],                       // the Shire, up to Farmer Maggot's
    ferry: ['ferry'],                                  // the Buckleberry Ferry shortcut
    brandywine: ['maggot', 'ferry', 'bree'],           // along the Brandywine River
    oldForest: ['bree', 'ferry'],                      // the Old Forest and the Barrow-downs
    nearBree: ['bree'],                                // on the way to Bree
    bree: ['bree', 'weathertop'],                      // Bree and just after it
    wilds: ['weathertop', 'rivendell'],                // Midgewater, Weathertop, the Trollshaws
    rivendell: ['rivendell', 'durin'],                 // Rivendell and just after it
    mountains: ['durin', 'lorien'],                    // Caradhras, Hollin and the Misty Mountains
    doors: ['durin'],                                  // the Doors of Durin
    moria: ['moria'],                                  // inside the Mines of Moria
    lorien: ['lorien', 'amonhen'],                     // Lothlórien and just after it
    anduin: ['amonhen'],                               // down the Great River to Amon Hen
    afterLorien: ['amonhen', 'emynmuil', 'marshes', 'ithilien', 'morgul', 'ungol', 'doom'],
    emynmuil: ['emynmuil'],                            // the rocky maze of the Emyn Muil
    marshes: ['marshes'],                              // the Dead Marshes
    gondorView: ['ithilien', 'morgul'],                // where Gondor can be seen to the west
    ithilien: ['ithilien'],                            // the green woods of Ithilien
    morgul: ['morgul'],                                // Minas Morgul
    ungol: ['ungol'],                                  // the stairs and tunnel of Cirith Ungol
    mordor: ['ungol', 'doom'],                         // inside Mordor
    farFromShire: ['weathertop', 'rivendell', 'durin', 'moria', 'lorien', 'amonhen', 'emynmuil', 'marshes', 'ithilien', 'morgul', 'ungol', 'doom']
  };

  // Place sentences, by area and kind of card.
  const PLACES = {
    shire: {
      forward: [
        'A kindly farmer of the Shire offers you a ride on his cart.',
        'The Shire mushrooms are good this year, and you feel light on your feet.',
        'A cheerful Shire postman hands you a letter and waves you along.',
        'Farmer Maggot\'s dogs are friendly today and trot you down the lane.',
        'The Gaffer waves from his garden gate and wishes you well.'
      ],
      back: [
        'Farmer Maggot\'s dogs chase you out of his field.',
        'You think you left the kettle on at Bag End, and hurry back to check.',
        'Lobelia Sackville-Baggins blocks the lane and scolds you about her spoons.'
      ],
      stay: [
        'A mug of cider at the Green Dragon, and no hurry at all.',
        'You count the stars above the Shire and drift off by the road.',
        'A Shire party is in full swing, and you stop for a dance.',
        'Mrs Maggot gives you a basket of mushrooms, and you stop to thank her.'
      ]
    },
    ferry: {
      forward: [
        'The Buckleberry Ferry glides smoothly across the Brandywine.',
        'Merry pushes the ferry off with a long pole, and you drift quickly across.'
      ],
      back: [
        'The current spins the ferry round, and you pole back towards the bank.'
      ],
      stay: [
        'The ferry bumps gently against the landing, and you wait while it is tied up.'
      ]
    },
    brandywine: {
      forward: [
        'A rainbow arches over the Brandywine, and you follow its colours.'
      ],
      back: [
        'The Brandywine is running high, and you go back to find a better crossing.'
      ],
      stay: [
        'You dip your toes in the cool Brandywine River.'
      ]
    },
    oldForest: {
      forward: [
        'Tom Bombadil shows you a shortcut through the willows.',
        'Tom Bombadil sings, and the trees of the Old Forest step aside.'
      ],
      back: [
        'A barrow-wight whispers from its mound, and you flee the way you came.',
        'A cold draught from the Barrow-downs chills you, and you pull back to a warmer path.',
        'Old Man Willow\'s roots trip you up, and you stumble backwards.',
        'The trees of the Old Forest shift, and the path leads you round in a circle.'
      ],
      stay: [
        'Tom Bombadil sings you a silly song, and time slips away.',
        'Goldberry lays out a fine supper, and you stay to eat it.',
        'Fog settles over the Barrow-downs, and you wait for it to lift.'
      ]
    },
    nearBree: {
      forward: [
        'Your old friends from Bree are waiting just ahead with a cart.',
        'The lights of Bree twinkle ahead, and you hurry towards them.'
      ]
    },
    bree: {
      forward: [
        'The folk of the Prancing Pony send you off with a cheer.',
        'A wagon of apples from Bree rolls by, and the driver lets you ride on top.',
        'Bill the pony joins the company and carries the heavy packs.'
      ],
      back: [
        'You left your cloak at the Prancing Pony and must go back for it.',
        'Barliman Butterbur forgot to send Gandalf\'s letter, and you go back to ask about it.'
      ],
      stay: [
        'Bree-folk gossip at the gate, and you stop to listen.',
        'Barliman Butterbur brings you a hot supper at the Prancing Pony.'
      ]
    },
    wilds: {
      forward: [
        'Glorfindel\'s white horse carries you swiftly towards the ford.',
        'From the top of Weathertop you spot the road winding east.',
        'Strider knows the wild lands well and leads you on.'
      ],
      back: [
        'A cloud of midges in the Midgewater Marshes sends you running back.',
        'A sleeping troll rumbles in the wood, and you tiptoe away.',
        'Black Riders gather below Weathertop, and you hide in a hollow.'
      ],
      stay: [
        'You find the three stone trolls from Bilbo\'s story, and stop to stare.',
        'The company lights a small fire on Weathertop and keeps watch.'
      ]
    },
    rivendell: {
      forward: [
        'Elrond\'s elves have swept the road clear of fallen branches.',
        'Elrond gives you a warm cloak and good advice for the road.',
        'Bilbo gives you his mithril coat, as light as a feather.'
      ],
      back: [
        'You go back to say one last goodbye to Bilbo.'
      ],
      stay: [
        'The cooks of Rivendell are preparing a fine supper, and you wait your turn.',
        'The bells of Rivendell chime softly, and you stop to listen.',
        'Bilbo reads you his newest poem, and it is a very long one.'
      ]
    },
    mountains: {
      forward: [
        'Gimli leads you along an old dwarf path over the hills.',
        'The holly trees of Hollin give you shelter, and you set off refreshed.'
      ],
      back: [
        'Thick snow falls on Caradhras, and you turn back for shelter.',
        'Saruman\'s crebain scatter across the sky, and you keep low.',
        'A thick fog rolls down from the Misty Mountains, and you lose your footing.'
      ],
      stay: [
        'Legolas walks lightly on top of the snow while you wait for a path to be dug.'
      ]
    },
    doors: {
      forward: [
        'You say "friend" in Elvish, and the Doors of Durin swing open.'
      ],
      back: [
        'The Watcher in the Water stirs, and you step away from the lake.'
      ],
      stay: [
        'Gandalf puzzles over the words on the Doors of Durin, and you wait.'
      ]
    },
    moria: {
      forward: [
        'Gandalf\'s staff lights the dark tunnels, and you find the way.',
        'You follow a line of glowing dwarf-lamps through the dark.'
      ],
      back: [
        'Drums beat in the deep, and you hurry back to a side passage.',
        'Pippin drops a stone down a well, and the echoes send you back.'
      ],
      stay: [
        'You rest in the great hall of Dwarrowdelf, where the pillars go up and up.',
        'Gimli stops to read the old dwarf runes on the wall.'
      ]
    },
    lorien: {
      forward: [
        'The elves of Lothlórien guide you along a silver path.',
        'The Lady of the Wood sends a gift of lembas bread.'
      ],
      back: [
        'Haldir stops you at the border, and you step back while he checks who you are.'
      ],
      stay: [
        'You climb up to a platform high in the mallorn trees and rest.',
        'Galadriel shows you her mirror, and you gaze into it for a while.',
        'The golden leaves of Lothlórien fall around you, and you stop to watch.'
      ]
    },
    anduin: {
      forward: [
        'An Elven boat carries you swiftly down the river.',
        'A swift current carries your boat downstream.',
        'You pass safely between the great stone kings of the Argonath.'
      ],
      back: [
        'Rapids spin your boat around, and you paddle back to calm water.',
        'Orc arrows fly from the east bank, and you paddle back into the mist.'
      ],
      stay: [
        'You pull the boats onto the shore and make camp for the night.',
        'The roar of the Falls of Rauros fills the air, and you stop to listen.'
      ]
    },
    afterLorien: {
      forward: [
        'You remember Galadriel\'s words, and your courage grows.',
        'The Lady\'s light shines on the road, and every step feels lighter.'
      ],
      stay: [
        'You nibble a corner of lembas, and one bite is enough to fill you up.'
      ]
    },
    emynmuil: {
      forward: [
        'Sam\'s Elven rope helps you climb down the cliffs.'
      ],
      back: [
        'The rocks of the Emyn Muil are a maze, and you end up back where you started.',
        'Gollum creeps down the cliff behind you, and you scramble back up.'
      ],
      stay: [
        'Sam\'s Elven rope comes untied by itself, and he stares at it in wonder.'
      ]
    },
    marshes: {
      forward: [
        'Gollum knows a safe path through the marshes and leads the way.'
      ],
      back: [
        'You take a wrong turn in the marshes and lose your bearings.',
        'Mist rolls over the Dead Marshes and swallows the path.'
      ],
      stay: [
        'Strange lights flicker over the Dead Marshes, and you try not to look.'
      ]
    },
    gondorView: {
      forward: [
        'The beacons of Gondor are lit, and their light shows the road.',
        'The lamps of Minas Tirith glow far to the west, and your heart lifts.'
      ]
    },
    ithilien: {
      forward: [
        'Faramir\'s rangers mark a safe path with white stones.',
        'A Ranger of Ithilien waves you through without delay.'
      ],
      back: [
        'A great oliphaunt crashes through the trees, and you leap out of its way.'
      ],
      stay: [
        'Sam stews a pair of rabbits with herbs, and everyone waits for supper.',
        'You rest in the cave behind the waterfall of Henneth Annûn.'
      ]
    },
    morgul: {
      forward: [
        'You creep past the gates of Minas Morgul without being seen.'
      ],
      back: [
        'A cold green light glows from Minas Morgul, and you shrink back.'
      ],
      stay: [
        'An army marches out of Minas Morgul, and you hide until it has passed.'
      ]
    },
    ungol: {
      forward: [
        'You climb the endless stairs of Cirith Ungol, one step at a time.'
      ],
      back: [
        'Shelob\'s webs block the tunnel, and you back away.'
      ],
      stay: [
        'Sam holds up the Lady\'s light, and you wait for the spider to back away.'
      ]
    },
    mordor: {
      forward: [
        'You put on orc armour and march along with the orcs, unseen.',
        'Sam lifts Frodo onto his back and carries him up the slope.'
      ],
      back: [
        'Ash falls from Mount Doom, and you stumble back through the smoke.',
        'An orc patrol marches by, and you hide behind the rocks.'
      ],
      stay: [
        'You share your last drop of water with Sam.',
        'Smoke covers the sun, and you wait for the air to clear.'
      ]
    },
    farFromShire: {
      forward: [
        'You think of home, and it gives you the strength to go on.'
      ],
      stay: [
        'You turn to look back at the Shire, far behind you now.'
      ]
    }
  };

  function weighted(table) {
    const keys = Object.keys(table);
    let total = 0;
    keys.forEach((k) => { total += table[k]; });
    let r = Math.random() * total;
    for (const k of keys) {
      r -= table[k];
      if (r < 0) return k;
    }
    return keys[keys.length - 1];
  }

  const pick = (list) => (list && list.length ? list[Math.floor(Math.random() * list.length)] : '');

  // All the place sentences of one kind that fit where the hobbit is.
  function placePhrases(kind, where) {
    const out = [];
    if (!where) return out;
    Object.keys(PLACES).forEach((area) => {
      if ((AREAS[area] || []).includes(where) && PLACES[area][kind]) out.push(...PLACES[area][kind]);
    });
    return out;
  }

  // where: the stop the hobbit's stretch of road leads to (or 'ferry' / 'moria'); optional.
  function draw(where) {
    if (Math.random() < SPECIAL_CHANCE) {
      const table = {};
      SPECIALS.forEach((sp, i) => { table[i] = sp.weight; });
      const sp = SPECIALS[Number(weighted(table))];
      return { kind: 'special', special: sp.special, move: sp.move, text: sp.text, phrase: pick(PHRASES[sp.special]) };
    }
    const kind = weighted(KIND_WEIGHTS);
    const steps = kind === 'stay' ? 0 : Number(weighted(STEP_WEIGHTS));
    const plural = steps === 1 ? ' space' : ' spaces';
    const text = kind === 'forward' ? 'Move forward ' + steps + plural
      : kind === 'back' ? 'Move back ' + steps + plural
      : 'Stay where you are';
    // the sentence is chosen after the move, so it never changes what the card does
    const local = placePhrases(kind, where);
    const phrase = local.length && Math.random() < PLACE_CHANCE ? pick(local) : pick(PHRASES[kind]);
    return {
      kind,                                   // 'forward' | 'back' | 'stay' (or 'special', above)
      move: kind === 'back' ? -steps : steps, // spaces to move: positive is forward
      text,                                   // the plain result, always shown
      phrase                                  // the themed sentence shown above the result
    };
  }

  window.HL_CARDS = { draw, placePhrases, KIND_WEIGHTS, STEP_WEIGHTS, PHRASES, PLACES, AREAS, SPECIALS, SPECIAL_CHANCE, PLACE_CHANCE };
})();
