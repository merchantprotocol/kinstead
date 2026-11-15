/** Owns the slide list and the current position; wires the router, drawer, counter and arrow buttons together. */
export class Deck {
  constructor({ slides, router, drawer, counter, prevButton, nextButton }) {
    this.slides = slides;
    this.router = router;
    this.drawer = drawer;
    this.counter = counter;
    this.prevButton = prevButton;
    this.nextButton = nextButton;
    this.index = -1;
  }

  start() {
    this.drawer.render(this.slides);
    this.drawer.onSelect((index) => this.go(index));
    this.router.onChange((index) => this.show(index));
    this.prevButton.addEventListener('click', () => this.prev());
    this.nextButton.addEventListener('click', () => this.next());
    this.show(this.router.current());
  }

  go(index) { this.router.go(this.clamp(index)); }
  next() { this.go(this.index + 1); }
  prev() { this.go(this.index - 1); }
  first() { this.go(0); }
  last() { this.go(this.slides.length - 1); }

  clamp(index) { return Math.min(Math.max(index, 0), this.slides.length - 1); }

  show(index) {
    const target = this.clamp(index);
    if (target === this.index) return;
    this.slides.forEach((slide, i) => (i === target ? slide.show() : slide.hide()));
    this.index = target;
    this.drawer.highlight(target);
    this.counter.textContent = `${target + 1} / ${this.slides.length}`;
    this.prevButton.disabled = target === 0;
    this.nextButton.disabled = target === this.slides.length - 1;
    document.title = `${this.slides[target].title} · Kinstead: how we built it`;
  }
}
