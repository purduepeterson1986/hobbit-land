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
  const KIND_WEIGHTS = { forward: 40, back: 35, stay: 25 };

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
      'A wind from the west fills your sails, and the road runs faster.',
      'Gwaihir the Windlord swoops low and nudges you onward.',
      'Strider points out a short cut through the trees.',
      'Gandalf\'s fireworks light the path ahead.',
      'A kindly farmer of the Shire offers you a ride in his cart.',
      'Elrond\'s elves have swept the road clear of fallen branches.',
      'Legolas spots the way ahead and waves you on.',
      'Bilbo\'s old song puts a spring in your step.',
      'The Ring hums softly, and the road seems shorter today.',
      'A cheerful Ent carries you a few strides on his shoulder.',
      'You hear Gimli laughing somewhere up ahead, and you hurry to catch up.',
      'The Lady of the Wood sends a gift of lembas bread.',
      'A passing Dúnadan shows you a hidden path.',
      'Radagast the Brown guides your steps with a birdcall.',
      'The sun breaks through the clouds, and your heart lifts.',
      'Merry and Pippin cheer you on from the roadside.',
      'A herd of ponies from the Riddermark trots past, and you ride along.',
      'Good friends at the Prancing Pony send you on your way with a cheer.',
      'The beacons of Gondor are lit, and their light shows the road.',
      'A rabbit leads you to a sheltered track through the hedges.',
      'Aragorn gives you a steady hand over the rocks.',
      'The eagles of the Misty Mountains are watching, and they wave you on.',
      'You remember the words of Galadriel, and your courage grows.',
      'A boat of the Elves carries you across the water.',
      'The Shire mushrooms are good this year, and you feel light on your feet.',
      'A fellow traveller shares a song and a shortcut.',
      'Your pack feels lighter, and you walk with a spring in your step.',
      'The Gap of Rohan opens up, and the road is easy.',
      'Bilbo\'s birthday gifts turn up on the road, and you feel very lucky.',
      'The Riders of Rohan cheer as they ride past, and you join in and hurry on.',
      'Treebeard\'s tree-herds part for you, and the path opens wide.',
      'A rainbow appears above the Brandywine, and you follow its arch.',
      'Faramir\'s rangers mark a safe path with white stones.',
      'A cheerful Shire postman hands you a letter and waves you along.',
      'The stars of Varda shine brightly, and you walk by their light.',
      'Sam sings a song about gardens, and you march to the rhythm.',
      'Tom Bombadil shows you a shortcut through the willows.',
      'An eagle feather falls at your feet, and hope rises in your chest.',
      'The lamps of Minas Tirith glow on the horizon, and you press towards them.',
      'A wagon of apples from Bree rolls by, and the driver lets you ride on top.',
      'Horns echo over the hills, and the road opens before you.',
      'Radagast\'s hedgehogs guide you along a secret lane.',
      'A pony from Rivendell trots up and offers you a saddle.',
      'The Elves of Lothlórien sing you on your way.',
      'Frodo smiles and says, \'Keep going, friend,\' and you do.',
      'The clouds part, and sunlight pours down on the road ahead.',
      'The Bridge of Khazad-dûm stands firm, and you cross it with ease.',
      'A kind old woman of Bree points you to a quicker path.',
      'The warm smell of the Prancing Pony\'s kitchen pulls you onward.',
      'You catch a glimpse of the White Tower, and your spirits rise.',
      'Gimli wagers you cannot reach the next milestone before supper, and you race it.',
      'A band of Rangers lifts you onto a horse and gallops off.',
      'The Shire\'s oldest song comes back to you, and your feet keep time.'
    ],
    back: [
      'A bridge is out, and you must find another way round.',
      'You take a wrong turn in the marshes and lose your bearings.',
      'A Nazgûl\'s shadow passes overhead, and you hide in the ditch.',
      'A tangle of brambles blocks the path, and you have to go back.',
      'Your boots pinch, and you turn back to fetch a spare pair.',
      'A sudden storm drives you off the road.',
      'Gollum\'s footprints lead you down the wrong track.',
      'The mist on the Dead Marshes swallows the path.',
      'A pack of wolves howls in the hills, and you pull back.',
      'A fallen tree lies across the road, and you must go round it.',
      'Your map was torn in the rain, and you lose the way.',
      'The Watcher in the Water stirs, and you step away from the lake.',
      'Orcs have blocked the pass, and you slip back into the shadows.',
      'A stone turns under your foot, and you slide down the slope.',
      'The river is high, and you must wait on the bank before going on.',
      'You stop to help a lost Shire hobbit and are led back a little way.',
      'A cloud of crows flaps up from the field and drives you back.',
      'The Ring grows heavy, and you sink back to rest.',
      'Sauron\'s eye sweeps across the land, and you shrink from view.',
      'Frodo\'s wounds ache, and you turn back to the last camp.',
      'A thick fog rolls in from the Misty Mountains, and you lose your footing.',
      'A stream floods the track, and you must wade back to the bank.',
      'The Dwimmerlaik whispers from the barrow, and you flee the way you came.',
      'You meet a cart stuck in the mud and must help pull it free.',
      'A snare on the path snaps shut, and you backtrack to find a safer road.',
      'The old roads of Eriador are overgrown, and you go back to find the track.',
      'Saruman\'s crebain scatter across the sky, and you keep low.',
      'A troll is sleeping in the wood, and you tiptoe away.',
      'You forget your cloak at the last inn and must turn back for it.',
      'Ringwraiths are riding the road, and you take cover in a hollow.',
      'The sun sets early, and you must find shelter for the night.',
      'A rockslide blocks the pass, and you must climb back down.',
      'A gust of wind takes your hat, and you turn back to fetch it.',
      'The Dead Marshes pull at your boots, and you wade back to firmer ground.',
      'A flock of crows scatters your map, and you go back to find the right track.',
      'Gollum hisses from the reeds, and you back away quietly.',
      'The bridge at Sarn Ford is washed away, and you have to backtrack.',
      'You take the wrong fork in the road and find yourself going back.',
      'A spider\'s web stretches across the path, and you stumble back out of it.',
      'The Black Riders are seen on the road ahead, and you retreat.',
      'Your pony bolts, and you must chase it back along the road.',
      'A wounded deer blocks the path, and you go round by the long way back.',
      'Thick snow falls on Caradhras, and you turn back to shelter.',
      'A wagon has overturned, and you help set it right before going back.',
      'The hobbit\'s wine has gone sour, and you return to the last inn for another.',
      'Orcs chase you through the trees, and you flee the way you came.',
      'Your lantern goes out, and you feel your way back along the path.',
      'The river crossing is ruined, and you turn back to find another ford.',
      'A troll\'s snores rumble from the hillside, and you tiptoe back.',
      'You forgot your pipe at the last camp and must go back for it.',
      'A rockfall buries the trail, and you retrace your steps.',
      'Boromir\'s horn sounds in the distance, and you hurry back to the company.',
      'A pack of wargs howls from the hill, and you slink back into the shadows.',
      'The road is blocked by Ents at a standstill, and you wait, then go back.'
    ],
    stay: [
      'Pippin wants second breakfast, and the company stops to eat.',
      'A brief rest by a clear stream. Nothing happens today.',
      'The Ring grows heavy, and you sit down to catch your breath.',
      'Bombadil sings you a silly song, and you forget the time.',
      'You stop to tie a boot, and the road waits for you.',
      'A kind innkeeper offers a warm bed for the night.',
      'Sam is busy washing the pots, so you wait for him to finish.',
      'A flock of sheep crosses the road, and you stop to let them pass.',
      'Rain falls softly, and you wait for it to ease.',
      'You stop to sing the Lay of Lúthien with the travellers around the fire.',
      'The cooks of Rivendell are preparing a fine supper, and you wait.',
      'Your pony needs its hooves seen to, so you wait while it rests.',
      'A quiet moment under the old trees. Time seems to stand still.',
      'You sit on a mossy stone and watch the clouds drift by.',
      'The company has lost the trail and must wait until morning.',
      'A cup of cider at the Green Dragon, and you take your time.',
      'You count the stars above the Shire and fall asleep by the road.',
      'Bree-folk gossip at the gate, and you stop to listen.',
      'Gandalf writes a letter, and you wait for him to finish.',
      'The Ring is hidden, and you lie low until the danger passes.',
      'You take a moment to look back at the Shire.',
      'Frodo sits quietly and remembers home.',
      'The horses are tired, and the company sets up camp.',
      'You help a family of badgers find their way home, and the road can wait.',
      'The elves sing softly, and you rest in their company.',
      'A moth flutters around your lantern, and you watch it for a while.',
      'You share a pipe of weed with Merry, and the road can wait.',
      'The wind drops, and the air is perfectly still.',
      'You finish a fine map of the road, and you pause to admire it.',
      'The dwarves of Erebor sit down for a long lunch, and you join them.',
      'A hobbit family invites you in for a hot meal and a warm fire.',
      'You stop to watch the sunset paint the hills gold.',
      'Merry tells a long story about his grandfather, and you sit and listen.',
      'A tavern keeper pours you a pint of ale. You linger a while.',
      'Gimli and Legolas argue about the number of trees in Fangorn, and you wait to hear the end.',
      'You stop to rest your feet in a cool river.',
      'The Elves hold a festival, and you wait to see the lanterns.',
      'A sudden shower makes you wait under an old oak tree.',
      'You take a nap in the long grass, and the road can wait.',
      'A rabbit dances across the path, and you stop to laugh.',
      'The company sings songs by the campfire long into the night.',
      'Sam stops to pick blackberries, and you help him.',
      'You stop to read an old scroll left by the roadside.',
      'The Ring is quiet for a while, and you take the chance to rest.',
      'A traveller tells you about the Shire\'s harvest, and you stop to hear more.',
      'The horses need water, so you stop by the trough and wait.',
      'A friendly ghost of the Barrow-downs is hard to ignore, so you wait for it to finish.',
      'Strider cooks a fine stew, and you wait for it to be ready.',
      'You stop to admire the mountain view, and the road waits.',
      'Pippin wants a longer nap, and you stop to rest with him.',
      'The wind rests too, and the air is still and warm.',
      'A bird sings from the branch above, and you stop to listen.',
      'Frodo writes in his book by the fire, and you wait to see what he writes.'
    ],
    eagles: [
      'Gwaihir and his brothers swoop down and lift you into the air.',
      'The Great Eagles of the Misty Mountains answer your call for help.',
      'An eagle drops from the sky and carries you over the hills.',
      'Gwaihir comes at the call of the Lord of the Eagles and bears you far along the road.',
      'The Eagles of the North swoop down in a great rush of wings.',
      'An eagle catches your cloak in its talons and lifts you up.'
    ],
    swap: [
      'A wandering Ent switches places with you, and you find yourself in a new spot.',
      'Gollum tricks you into trading places, and you hurry to keep up.',
      'You meet a fellow traveller on the road and swap places with them.',
      'Tom Bombadil laughs, and you trade places with him.',
      'A hobbit family swaps places with you on the road.',
      'Sméagol switches places with you while you are looking the other way.'
    ],
    skip: [
      'Gollum creeps up and steals your turn.',
      'Gollum slips out of the shadows and takes your turn away.',
      'Sméagol whispers a riddle, and you lose your turn while you puzzle it out.',
      'Gollum steals your turn while you sleep by the road.',
      'Gollum hides under a rock and takes your turn from you.',
      'Gollum makes a riddle, and you lose the next turn while you guess.'
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
