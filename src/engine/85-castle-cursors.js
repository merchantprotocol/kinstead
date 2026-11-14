/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · cursors for the mystical frozen-castle theme. Hand-painted SVG (steel, gold trim, ember glow,
   frost-blue runes) instead of the 16px pixel icons. K.Icons.cursor() asks this set first, so every hover
   in play mode (walk, chop, mine, dig, attack, talk, no) picks it up; any id without a painting falls back. */
(function (G) {
  const K = G.K;
  const W = 44;
  const DEFS = `<defs>
    <linearGradient id='st' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f3fbff'/><stop offset='.45' stop-color='#a9d2e8'/><stop offset='1' stop-color='#4f7d9c'/></linearGradient>
    <linearGradient id='gd' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffe9a0'/><stop offset='.55' stop-color='#e2a63a'/><stop offset='1' stop-color='#9a5f14'/></linearGradient>
    <linearGradient id='wd' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#9a6a38'/><stop offset='1' stop-color='#4d2e14'/></linearGradient>
    <radialGradient id='em'><stop offset='0' stop-color='#fff6c8'/><stop offset='.4' stop-color='#ffb04a'/><stop offset='1' stop-color='#ff5a1a' stop-opacity='0'/></radialGradient>
    <radialGradient id='fr'><stop offset='0' stop-color='#e8f8ff'/><stop offset='.5' stop-color='#7fd0ff' stop-opacity='.8'/><stop offset='1' stop-color='#3f82aa' stop-opacity='0'/></radialGradient>
    <filter id='gl' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='1.4'/></filter>
  </defs>`;
  const O = "stroke='#0a1020' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round'";   // the dark ink outline that keeps every cursor readable on snow
  const spark = (x, y, r = 2.2) => `<path d='M${x} ${y - r}L${x + r * .35} ${y - r * .35}L${x + r} ${y}L${x + r * .35} ${y + r * .35}L${x} ${y + r}L${x - r * .35} ${y + r * .35}L${x - r} ${y}L${x - r * .35} ${y - r * .35}Z' fill='#e8f8ff' stroke='#0a1020' stroke-width='.7'/>`;
  const gem = (x, y, r = 2.4) => `<circle cx='${x}' cy='${y}' r='${r * 2.4}' fill='url(#em)' opacity='.85'/><circle cx='${x}' cy='${y}' r='${r}' fill='#ff7a2a' stroke='#0a1020' stroke-width='1'/><circle cx='${x - r * .3}' cy='${y - r * .3}' r='${r * .38}' fill='#fff2b0'/>`;

  const ART = {
    /* open ground: a waypoint rune ring */
    boot: { hot: [22, 22], body: `<circle cx='22' cy='22' r='15' fill='none' stroke='#0a1020' stroke-width='4.6' opacity='.55'/>
      <circle cx='22' cy='22' r='15' fill='none' stroke='url(#gd)' stroke-width='2.2' stroke-dasharray='4.2 2.6'/>
      <circle cx='22' cy='22' r='9' fill='none' stroke='#9fdcff' stroke-width='1.3' opacity='.95'/>
      <circle cx='22' cy='22' r='9' fill='none' stroke='#0a1020' stroke-width='.5' opacity='.5'/>
      <path d='M22 3.5l2.2 3.2-2.2 3.2-2.2-3.2zM22 34.1l2.2 3.2-2.2 3.2-2.2-3.2zM3.5 22l3.2-2.2 3.2 2.2-3.2 2.2zM34.1 22l3.2-2.2 3.2 2.2-3.2 2.2z' fill='url(#gd)' stroke='#0a1020' stroke-width='.8'/>
      ${gem(22, 22, 2.6)}` },
    /* the default pointer: an ember-edged gold shard */
    pointer: { hot: [4, 4], body: `<path d='M4 3.5L4 33.5L12.2 26.2L18.2 39.2L24 36.6L18 23.8L29.4 23.4Z' fill='url(#gd)' ${O}/>
      <path d='M6.4 9L6.4 27.6L12 22.6L18.9 37' fill='none' stroke='#fff3c4' stroke-width='1' opacity='.7'/>
      <path d='M6.4 9.2L24.4 22.6L14 23.4Z' fill='#fff3c4' opacity='.35'/>${gem(11.5, 17.5, 1.6)}` },
    /* "you are over something clickable but with no verb": the same shard, lit blue */
    hand: { hot: [4, 4], alias: 'pointer' },
    bag: { hot: [4, 4], alias: 'pointer' },
    no: { hot: [22, 22], body: `<circle cx='22' cy='22' r='13' fill='#101826' fill-opacity='.45' stroke='#0a1020' stroke-width='4.2'/>
      <circle cx='22' cy='22' r='13' fill='none' stroke='#8a98ab' stroke-width='2' stroke-dasharray='3 2.4'/>
      <path d='M13.2 30.8L30.8 13.2' stroke='#0a1020' stroke-width='5' stroke-linecap='round'/><path d='M13.2 30.8L30.8 13.2' stroke='#e0574a' stroke-width='2.6' stroke-linecap='round'/>` },
    /* attack: a rune-sword, point up-left */
    sword: { hot: [4, 4], body: `<path d='M4 4L10 5.6L29 24.6L24.6 29L5.6 10Z' fill='url(#st)' ${O}/>
      <path d='M7 7.4L26.2 26.6' stroke='#fff' stroke-width='1.1' opacity='.75'/>
      <path d='M20 33.4L33.4 20L36.6 23.2L23.2 36.6Z' fill='url(#gd)' ${O}/>
      <path d='M29.6 29.6L38.4 38.4' stroke='#0a1020' stroke-width='6' stroke-linecap='round'/><path d='M29.6 29.6L38.4 38.4' stroke='url(#wd)' stroke-width='3.6' stroke-linecap='round'/>
      <circle cx='40' cy='40' r='3' fill='url(#gd)' stroke='#0a1020' stroke-width='1.1'/>${gem(28.4, 28.4, 1.8)}${spark(14, 12, 2.4)}` },
    /* chop: a frost-forged axe, bit at the top-left */
    axe: { hot: [6, 6], body: `<path d='M17 17L38 38' stroke='#0a1020' stroke-width='6.6' stroke-linecap='round'/><path d='M17 17L38 38' stroke='url(#wd)' stroke-width='4' stroke-linecap='round'/>
      <path d='M5 12.4C6.2 6.6 11 4.2 16.4 5.2L26.2 8.4C27.4 12.4 25.4 17.6 21.2 21L14.6 18.8C14 15.8 11.2 14.2 5 12.4Z' fill='url(#st)' ${O}/>
      <path d='M5.6 11.6C7.4 7.2 11 6.2 15.4 6.8' fill='none' stroke='#ff9a3a' stroke-width='1.6' stroke-linecap='round'/>
      <path d='M12 12.4L22.4 11.4' stroke='#fff' stroke-width='.9' opacity='.7'/>
      <path d='M15.4 20.6L19.6 24.8L22.6 21.8L18.4 17.6Z' fill='url(#gd)' ${O}/>${spark(21, 9.5, 2)}` },
    /* mine: a pick with an ember-lit head */
    pickaxe: { hot: [6, 6], body: `<path d='M16 16L38 38' stroke='#0a1020' stroke-width='6.6' stroke-linecap='round'/><path d='M16 16L38 38' stroke='url(#wd)' stroke-width='4' stroke-linecap='round'/>
      <path d='M4.6 24.4C4.4 12 12 4.8 25 4.8C22.2 7.4 20.6 10 20 13.2C15.4 12.4 10.6 16.4 8.6 22.4Z' fill='url(#st)' ${O}/>
      <path d='M5.4 22.4C6 13.4 11.2 7.6 20 6.2' fill='none' stroke='#ff9a3a' stroke-width='1.4' stroke-linecap='round' opacity='.9'/>
      <path d='M14.4 17.2L18.8 21.6L21.8 18.6L17.4 14.2Z' fill='url(#gd)' ${O}/>${spark(12, 12, 1.9)}` },
    /* dig: a spade, blade down */
    shovel: { hot: [22, 40], body: `<path d='M22 6L22 27' stroke='#0a1020' stroke-width='6.4' stroke-linecap='round'/><path d='M22 6L22 27' stroke='url(#wd)' stroke-width='3.8' stroke-linecap='round'/>
      <path d='M14.4 5.4L29.6 5.4' stroke='#0a1020' stroke-width='6' stroke-linecap='round'/><path d='M14.4 5.4L29.6 5.4' stroke='url(#gd)' stroke-width='3.4' stroke-linecap='round'/>
      <path d='M14 25.4L30 25.4C31.2 32.4 28.6 38 22 41.6C15.4 38 12.8 32.4 14 25.4Z' fill='url(#st)' ${O}/>
      <path d='M17.4 28.4C17.6 32.4 19 35.2 22 37.4' fill='none' stroke='#fff' stroke-width='1.1' opacity='.7'/>
      <path d='M15 26.4L29 26.4' stroke='#ff9a3a' stroke-width='1.4' opacity='.9'/>${spark(32, 33, 2)}` },
    /* build / repair: a rune hammer */
    hammer: { hot: [6, 6], body: `<path d='M14 14L38 38' stroke='#0a1020' stroke-width='6.6' stroke-linecap='round'/><path d='M14 14L38 38' stroke='url(#wd)' stroke-width='4' stroke-linecap='round'/>
      <path d='M5 13L13 5L26 18L18 26Z' fill='url(#st)' ${O}/><path d='M8.4 12.6L13.4 7.6' stroke='#fff' stroke-width='1.1' opacity='.75'/>
      <path d='M20.6 10.4L29.4 19.2' stroke='#ff9a3a' stroke-width='1.6' opacity='.9'/>${gem(15.5, 15.5, 1.7)}` },
    /* the bow: a yew bow, string drawn, an arrow nocked */
    bow: { hot: [22, 22], body: `<path d='M13 5Q33 22 13 39' fill='none' stroke='#0a1020' stroke-width='6.6' stroke-linecap='round'/><path d='M13 5Q33 22 13 39' fill='none' stroke='url(#wd)' stroke-width='4' stroke-linecap='round'/>
      <path d='M13 5L13 39' stroke='#0a1020' stroke-width='2.6'/><path d='M13 5L13 39' stroke='#e8eef6' stroke-width='1'/>
      <path d='M13 22L37 22' stroke='#0a1020' stroke-width='3.6' stroke-linecap='round'/><path d='M13 22L36 22' stroke='url(#gd)' stroke-width='1.8' stroke-linecap='round'/><path d='M37 22L31 18.4L31 25.6Z' fill='url(#st)' ${O}/>${spark(25, 14, 2)}` },
    /* take down: the rune hammer, struck across with a red slash */
    demolish: { hot: [6, 6], body: `<path d='M14 14L38 38' stroke='#0a1020' stroke-width='6.6' stroke-linecap='round'/><path d='M14 14L38 38' stroke='url(#wd)' stroke-width='4' stroke-linecap='round'/>
      <path d='M5 13L13 5L26 18L18 26Z' fill='url(#st)' ${O}/><path d='M20.6 10.4L29.4 19.2' stroke='#ff9a3a' stroke-width='1.6' opacity='.9'/>
      <circle cx='31' cy='12' r='9' fill='#12203a' fill-opacity='.85' stroke='#0a1020' stroke-width='1.2'/><path d='M26 7L36 17M36 7L26 17' stroke='#0a1020' stroke-width='4.6' stroke-linecap='round'/><path d='M26 7L36 17M36 7L26 17' stroke='#ff5a4a' stroke-width='2.6' stroke-linecap='round'/>` },
    /* talk: a spirit bubble with three runes */
    bubble: { hot: [8, 36], body: `<path d='M8 36L13.6 28.6C8 26 5 21.8 5 17C5 9.8 12.6 5 22 5C31.4 5 39 9.8 39 17C39 24.2 31.4 29 22 29C20 29 18.2 28.8 16.4 28.4Z' fill='#12203a' fill-opacity='.92' stroke='url(#gd)' stroke-width='2.4' stroke-linejoin='round'/>
      <path d='M8 36L13.6 28.6C8 26 5 21.8 5 17' fill='none' stroke='#0a1020' stroke-width='.8'/>
      <circle cx='14' cy='17' r='2.3' fill='#9fdcff'/><circle cx='22' cy='17' r='2.3' fill='#ffb04a'/><circle cx='30' cy='17' r='2.3' fill='#9fdcff'/>` },
    /* trade: a gold coin with a star */
    coin: { hot: [22, 22], body: `<circle cx='22' cy='22' r='15' fill='url(#gd)' ${O}/><circle cx='22' cy='22' r='10.6' fill='none' stroke='#8a5410' stroke-width='1.3'/>
      <path d='M22 12.6L24.8 19.2L32 19.8L26.4 24.4L28.2 31.4L22 27.6L15.8 31.4L17.6 24.4L12 19.8L19.2 19.2Z' fill='#fff3c4' stroke='#8a5410' stroke-width='.9'/>` },
    /* inspect: a seer's eye */
    eye: { hot: [22, 22], body: `<path d='M3.6 22C9 12.4 15 8.8 22 8.8C29 8.8 35 12.4 40.4 22C35 31.6 29 35.2 22 35.2C15 35.2 9 31.6 3.6 22Z' fill='#12203a' fill-opacity='.94' stroke='url(#gd)' stroke-width='2.4' stroke-linejoin='round'/>
      <circle cx='22' cy='22' r='8.2' fill='url(#fr)'/><circle cx='22' cy='22' r='5.6' fill='#4fb4ee' stroke='#0a1020' stroke-width='1'/><circle cx='22' cy='22' r='2.4' fill='#0a1020'/><circle cx='19.8' cy='19.8' r='1.3' fill='#fff'/>` },
  };

  const cache = new Map();
  const def = (id) => { const a = ART[id]; return a && a.alias ? Object.assign({}, ART[a.alias], { hot: a.hot || ART[a.alias].hot }) : a; };
  const CursorArt = {
    ids: () => Object.keys(ART),
    has: (id) => !!def(id),
    svg(id) { const a = def(id); return a ? `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${W}' viewBox='0 0 ${W} ${W}'>${DEFS}${a.body}</svg>` : null; },
    css(id, fallback = 'pointer') {
      const k = id + '|' + fallback; if (cache.has(k)) return cache.get(k);
      const a = def(id), s = CursorArt.svg(id); if (!a || !s) return null;
      const v = `url("data:image/svg+xml,${encodeURIComponent(s)}") ${a.hot[0]} ${a.hot[1]}, ${fallback}`; cache.set(k, v); return v;
    },
  };
  K.CursorArt = CursorArt;

  /* every K.Icons.cursor(id) call in the game goes through here first */
  const Icons = K.Icons, orig = Icons.cursor;
  Icons.cursor = (id, fallback = 'pointer') => CursorArt.css(id, fallback) || orig.call(Icons, id, fallback);
})(typeof window !== 'undefined' ? window : globalThis);
