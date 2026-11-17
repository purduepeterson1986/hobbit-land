/* Hobbit Land — the four hobbits: colours, the board token and the portrait.
   All drawings are original shapes made here, no outside artwork. */
(function () {
  'use strict';

  const HOBBITS = [
    { id: 'frodo', name: 'Frodo', color: '#2f6fc0', dark: '#1b4277', light: '#9cc3f2', hair: '#3a2414', vest: '#efe4c8', skin: '#f2c9a3' },
    { id: 'sam', name: 'Sam', color: '#d49a22', dark: '#87600f', light: '#f6d68b', hair: '#80522a', vest: '#7b5a36', skin: '#eebf96' },
    { id: 'merry', name: 'Merry', color: '#2e9657', dark: '#1a5e36', light: '#9fdcb4', hair: '#6a3f1f', vest: '#dcc79c', skin: '#f0c49c' },
    { id: 'pippin', name: 'Pippin', color: '#c8433a', dark: '#7c241f', light: '#f2a49c', hair: '#a5562b', vest: '#eadbb3', skin: '#f3cba6' }
  ];

  // A standing hobbit. The feet are at (0, 0) and the top of the hair is about y = -49.
  function figure(h) {
    return '' +
      '<ellipse cx="0" cy="-1" rx="13" ry="4.6" fill="' + h.dark + '"/>' +
      '<ellipse cx="0" cy="-2.4" rx="12" ry="3.8" fill="' + h.color + '"/>' +
      '<ellipse cx="-4.6" cy="-4.4" rx="4.3" ry="2.3" fill="' + h.skin + '" stroke="#9b6a45" stroke-width=".6"/>' +
      '<ellipse cx="4.6" cy="-4.4" rx="4.3" ry="2.3" fill="' + h.skin + '" stroke="#9b6a45" stroke-width=".6"/>' +
      '<path d="M-5.6,-5.4 l1.2,-1.2 M-3.6,-5.6 l1,-1.2 M3.6,-5.6 l-1,-1.2 M5.6,-5.4 l-1.2,-1.2" stroke="' + h.hair + '" stroke-width=".8" stroke-linecap="round"/>' +
      '<rect x="-6" y="-13" width="12" height="8" rx="2" fill="#6b4a2b"/>' +
      '<path d="M-9,-31 C-12.5,-23 -13.5,-15 -12.5,-8.5 Q0,-5 12.5,-8.5 C13.5,-15 12.5,-23 9,-31 Z" fill="' + h.color + '" stroke="' + h.dark + '" stroke-width="1"/>' +
      '<path d="M-4.4,-30.5 L0,-15 L4.4,-30.5 Z" fill="' + h.vest + '"/>' +
      '<path d="M-9,-31 C-11,-24 -12,-17 -12,-10" stroke="' + h.light + '" stroke-width="1.2" fill="none" opacity=".55"/>' +
      '<circle cx="0" cy="-30" r="1.8" fill="#86c96f" stroke="#2d5a1e" stroke-width=".6"/>' +
      '<path d="M-7.2,-39 l-3.6,-4.4 l1.4,6.2 Z M7.2,-39 l3.6,-4.4 l-1.4,6.2 Z" fill="' + h.skin + '" stroke="#b07a52" stroke-width=".5"/>' +
      '<circle cx="0" cy="-37.5" r="8.2" fill="' + h.skin + '" stroke="#b07a52" stroke-width=".5"/>' +
      '<g fill="' + h.hair + '">' +
      '<circle cx="-6.4" cy="-41.2" r="3.3"/><circle cx="-3.2" cy="-44.4" r="3.4"/><circle cx="0.8" cy="-45.4" r="3.4"/>' +
      '<circle cx="4.6" cy="-43.6" r="3.3"/><circle cx="7.2" cy="-40.2" r="2.8"/><circle cx="-7.8" cy="-37.6" r="2.2"/>' +
      '</g>' +
      '<circle cx="-2.9" cy="-37" r="1.15" fill="#2a1a10"/><circle cx="2.9" cy="-37" r="1.15" fill="#2a1a10"/>' +
      '<circle cx="-4.8" cy="-34.4" r="1.6" fill="#ff8f7a" opacity=".35"/><circle cx="4.8" cy="-34.4" r="1.6" fill="#ff8f7a" opacity=".35"/>' +
      '<path d="M-2.6,-33.6 Q0,-31.6 2.6,-33.6" stroke="#8a4a2a" stroke-width=".9" fill="none" stroke-linecap="round"/>';
  }

  // Head-and-shoulders picture for menus and the player bar.
  function portrait(h, cls) {
    return '<svg class="' + (cls || 'portrait') + '" viewBox="-15 -52 30 30" aria-hidden="true">' +
      '<circle cx="0" cy="-37" r="15" fill="' + h.light + '" opacity=".35"/>' + figure(h) + '</svg>';
  }

  const byId = (id) => HOBBITS.find((h) => h.id === id);

  window.HL_HOBBITS = { list: HOBBITS, byId, figure, portrait };
})();
