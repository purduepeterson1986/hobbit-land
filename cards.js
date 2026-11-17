/* Hobbit Land — the cards a player turns over when they land on a card space.
 *
 * Every card is made up fresh when it is drawn:
 *   1. pick what kind of card it is (forward, back or stay) using KIND_WEIGHTS;
 *   2. pick how many spaces to move using STEP_WEIGHTS;
 *   3. (later) pick a Lord of the Rings phrase for that kind from PHRASES.
 *
 * About 1 card in 15 is a rare SPECIAL card instead (see SPECIALS below).
 *
 * To add themed phrasing later, put sentences in PHRASES. Each kind's list is used
 * only for that kind of card, so a "back" phrase never shows up on a "forward" card.
 * Write a phrase without the move; the game adds the move underneath it.
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

  // Lord of the Rings flavour. One sentence is picked at random for each card.
  // Write without the number of spaces; the game adds the move underneath.
  const PHRASES = {
    forward: [
      'A friendly Rohan horse gives you a lift along the road.',
      'Sam finds a fresh loaf and a wheel of cheese in your pack.',
      'A west wind fills your sails and carries you on.',
      'Gwaihir the Windlord swoops low and nudges you onward.',
      'Strider points out a short cut through the trees.',
      'Gandalf\'s fireworks light up the path ahead.',
      'A kindly farmer of the Shire offers you a ride on his cart.',
      'Elrond\'s elves have swept the road clear of fallen branches.',
      'Legolas spots the way ahead and waves you on.',
      'Bilbo\'s old song puts a spring in your step.',
      'The Ring hums softly, and the road seems shorter today.',
      'A cheerful Ent carries you a few strides on his shoulder.',
      'You hear Gimli laughing up ahead, and you hurry to catch up.',
      'The Lady of the Wood sends a gift of lembas bread.',
      'A passing Dúnadan shows you a hidden path.',
      'Radagast the Brown guides your steps with a birdcall.',
      'The sun breaks through the clouds, and your heart lifts.',
      'Merry and Pippin cheer you on from the roadside.',
      'A herd of ponies from the Riddermark trots past, and you ride along.',
      'The folk of the Prancing Pony send you off with a cheer.',
      'The beacons of Gondor are lit, and their light shows the road.',
      'A rabbit leads you along a sheltered track through the hedges.',
      'Aragorn offers you a steady hand over the rocks.',
      'The eagles of the Misty Mountains watch over you and wave you on.',
      'You remember Galadriel\'s words, and your courage grows.',
      'An Elven boat carries you swiftly across the water.',
      'The Shire mushrooms are good this year, and you feel light on your feet.',
      'A fellow traveller shares a song and a shortcut.',
      'Your pack feels lighter, and you walk with a spring in your step.',
      'The Gap of Rohan opens wide, and the road runs easy.',
      'Bilbo\'s birthday gifts turn up on the road, and your luck is high.',
      'The Riders of Rohan cheer as they pass, and you join in and hurry on.',
      'Treebeard\'s tree-herds part for you, and the path opens wide.',
      'A rainbow arches over the Brandywine, and you follow its colours.',
      'Faramir\'s rangers mark a safe path with white stones.',
      'A cheerful Shire postman hands you a letter and waves you along.',
      'The stars of Varda shine brightly, and you walk by their light.',
      'Sam sings a song about gardens, and you march to the rhythm.',
      'Tom Bombadil shows you a shortcut through the willows.',
      'An eagle feather drifts down at your feet, and hope rises in your chest.',
      'The lamps of Minas Tirith glow on the horizon, and you press towards them.',
      'A wagon of apples from Bree rolls by, and the driver lets you ride on top.',
      'Horns echo over the hills, and the road opens before you.',
      'Gimli wagers you cannot reach the next milestone before supper, and you race to prove him wrong.',
      'A band of Rangers lifts you onto a horse and gallops off with you.',
      'The old songs of the Shire come back to you, and your feet keep time.',
      'Lady Galadriel\'s light shines on the road, and every step feels lighter.',
      'A pack pony trots up, carrying nothing but good cheer.',
      'The Lord of the Eagles hears your call and sends a friendly wind.',
      'A cask of the Old Took\'s finest ale is waiting at the next inn.',
      'Sméagol is nowhere to be seen, and the road is blissfully clear.',
      'A spring of clear water makes the road feel fresh again.',
      'The Dwarves of Erebor sing a marching song, and you march along beside them.',
      'A friendly Gondorian guard waves you through the gate without delay.',
      'Your old friends from Bree are waiting just ahead with a cart.'
    ],
    back: [
      'A bridge has washed out, and you must find another way round.',
      'You take a wrong turn in the marshes and lose your bearings.',
      'A Nazgûl\'s shadow glides overhead, and you duck into a ditch.',
      'A tangle of brambles blocks the path, and you must retreat.',
      'Your boot pinches, and you turn back to fetch a spare.',
      'A sudden storm drives you off the road.',
      'Gollum\'s footprints lead you down the wrong track.',
      'Mist rolls over the Dead Marshes and swallows the path.',
      'A pack of wolves howls in the hills, and you fall back.',
      'A fallen tree bars the road, and you must go back round it.',
      'Rain has smudged your map, and you lose the way.',
      'The Watcher in the Water stirs, and you step away from the lake.',
      'Orcs hold the pass, and you slip back into the shadows.',
      'A loose stone turns under your foot, and you slide down the slope.',
      'The river is in flood, and you wait on the bank before going on.',
      'You stop to help a lost Shire hobbit and are led back a little way.',
      'A cloud of crows bursts from the field and drives you back.',
      'The Ring grows heavy, and you sink back to rest.',
      'Sauron\'s eye sweeps the land, and you shrink from its gaze.',
      'Frodo\'s old wound aches, and you turn back to the last camp.',
      'A thick fog rolls down from the Misty Mountains, and you lose your footing.',
      'A stream floods the track, and you wade back to the bank.',
      'A barrow-wight whispers from its mound, and you flee the way you came.',
      'A cart is stuck in the mud, and you help heave it free before going on.',
      'A hidden snare snaps shut, and you backtrack to a safer road.',
      'The old road of Eriador is overgrown, and you go back to find the track.',
      'Saruman\'s crebain scatter across the sky, and you keep low.',
      'A sleeping troll rumbles in the wood, and you tiptoe away.',
      'You left your cloak at the last inn and must turn back for it.',
      'Ringwraiths ride the road ahead, and you take cover in a hollow.',
      'Night falls early, and you must turn back to find shelter.',
      'A rockslide buries the trail, and you retrace your steps.',
      'Boromir\'s horn sounds in the distance, and you hurry back to the company.',
      'A pack of wargs howls from the hill, and you slink back into the shadows.',
      'Ents stand across the road in deep discussion, so you wait, then go back.',
      'A gust of wind snatches your hat, and you chase it back along the road.',
      'The bridge at Sarn Ford is gone, and you must backtrack.',
      'A spider\'s web stretches across the path, and you stumble back out of it.',
      'Your pony bolts, and you must chase it back along the road.',
      'Thick snow falls on Caradhras, and you turn back for shelter.',
      'A cold draught from the Barrow-downs chills you, and you pull back to a warmer path.',
      'A goblin\'s arrow whistles past, and you dive back behind the rocks.',
      'Heavy rain turns the track to mud, and you slip back down the hill.',
      'A hungry wolf blocks the path, and you retreat to a safer road.',
      'Your lantern flickers out, and you grope your way back to the last signpost.',
      'The Witch-king\'s horn sounds, and you turn tail and run.',
      'A sudden fall of rocks forces you to clamber back down the slope.',
      'A stubborn ferryman refuses to take you across, and you turn back.',
      'The road ahead is blocked by a fallen oak, so you circle back the way you came.',
      'A gang of orcs spots you, and you slip away down the hill.',
      'Thorny brambles tear at your cloak, and you retreat to find another way.',
      'A sudden fog hides the path, and you wait it out by going back a little.',
      'A rotten plank gives way beneath you, and you scramble back to dry ground.',
      'A fierce gale knocks you off balance, and you stagger back a few steps.'
    ],
    stay: [
      'Pippin asks for second breakfast, and the company stops to eat.',
      'A brief rest by a clear stream. Nothing much happens today.',
      'The Ring grows heavy, and you sit down to catch your breath.',
      'Tom Bombadil sings you a silly song, and time slips away.',
      'You stop to tie a loose bootlace, and the road waits for you.',
      'A kind innkeeper offers a warm bed for the night.',
      'Sam is washing the pots, so you wait for him to finish.',
      'A flock of sheep crosses the road, and you pause to let them pass.',
      'A soft rain falls, and you wait under the trees for it to ease.',
      'The company sings the Lay of Lúthien by the fire.',
      'The cooks of Rivendell are preparing a fine supper, and you wait your turn.',
      'Your pony needs its hooves seen to, and you rest while it does.',
      'A quiet moment under the old trees. Time seems to stand still.',
      'You sit on a mossy stone and watch the clouds drift by.',
      'The company has lost the trail and must wait for morning.',
      'A mug of cider at the Green Dragon, and no hurry at all.',
      'You count the stars above the Shire and drift off by the road.',
      'Bree-folk gossip at the gate, and you stop to listen.',
      'Gandalf writes a letter, and you wait for him to finish.',
      'The Ring is hidden, and you lie low until the danger passes.',
      'You turn to look back at the Shire, far behind you now.',
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
      'A friendly ghost of the Barrow-downs is hard to ignore, so you wait for it to finish.',
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
      'The bells of Rivendell chime softly, and you stop to listen.',
      'A traveller offers you a warm blanket, and you rest a while.'
    ],
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

  function draw() {
    if (Math.random() < SPECIAL_CHANCE) {
      const table = {};
      SPECIALS.forEach((sp, i) => { table[i] = sp.weight; });
      const sp = SPECIALS[Number(weighted(table))];
      const sList = PHRASES[sp.special];
      const sPhrase = sList && sList.length ? sList[Math.floor(Math.random() * sList.length)] : '';
      return { kind: 'special', special: sp.special, move: sp.move, text: sp.text, phrase: sPhrase };
    }
    const kind = weighted(KIND_WEIGHTS);
    const steps = kind === 'stay' ? 0 : Number(weighted(STEP_WEIGHTS));
    const plural = steps === 1 ? ' space' : ' spaces';
    const text = kind === 'forward' ? 'Move forward ' + steps + plural
      : kind === 'back' ? 'Move back ' + steps + plural
      : 'Stay where you are';
    const list = PHRASES[kind];
    const phrase = list && list.length ? list[Math.floor(Math.random() * list.length)] : '';
    return {
      kind,                                   // 'forward' | 'back' | 'stay' (or 'special', above)
      move: kind === 'back' ? -steps : steps, // spaces to move: positive is forward
      text,                                   // the plain result, always shown
      phrase                                  // themed sentence, '' until PHRASES are written
    };
  }

  window.HL_CARDS = { draw, KIND_WEIGHTS, STEP_WEIGHTS, PHRASES, SPECIALS, SPECIAL_CHANCE };
})();
