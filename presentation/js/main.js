import { Slide } from './Slide.js';
import { Router } from './Router.js';
import { Drawer } from './Drawer.js';
import { Deck } from './Deck.js';
import { KeyboardNav } from './KeyboardNav.js';
import { Fullscreen } from './Fullscreen.js';
import { PreferenceStore } from './PreferenceStore.js';

/** Composition root: builds the objects and connects them. No logic lives here. */
const slides = [...document.querySelectorAll('.slide')].map((element, index) => new Slide(element, index));
const store = new PreferenceStore(window.localStorage, 'kinstead-story.');
const drawer = new Drawer(
  document.getElementById('drawer'),
  document.getElementById('drawer-list'),
  document.getElementById('drawer-toggle'),
  store,
);
const deck = new Deck({
  slides,
  router: new Router(window, slides.length),
  drawer,
  counter: document.getElementById('counter'),
  prevButton: document.getElementById('prev'),
  nextButton: document.getElementById('next'),
});
const fullscreen = new Fullscreen(document);
document.getElementById('fullscreen').addEventListener('click', () => fullscreen.toggle());
new KeyboardNav(document, {
  next: () => deck.next(),
  prev: () => deck.prev(),
  first: () => deck.first(),
  last: () => deck.last(),
  toggleDrawer: () => drawer.toggle(),
  fullscreen: () => fullscreen.toggle(),
});
deck.start();
document.body.classList.add('is-ready');
