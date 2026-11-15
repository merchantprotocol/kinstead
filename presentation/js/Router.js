/** Keeps the URL hash (#/7, one-based) in step with the current slide so refreshes and deep links work. */
export class Router {
  constructor(win, count) {
    this.win = win;
    this.count = count;
    this.listeners = [];
    this.win.addEventListener('hashchange', () => this.emit());
  }

  /** Zero-based slide index from the hash, clamped; 0 when absent or invalid. */
  current() {
    const match = /^#\/(\d+)$/.exec(this.win.location.hash);
    if (!match) return 0;
    const index = Number(match[1]) - 1;
    return Math.min(Math.max(index, 0), this.count - 1);
  }

  go(index) {
    const hash = `#/${index + 1}`;
    if (this.win.location.hash !== hash) this.win.location.hash = hash;
    else this.emit();
  }

  onChange(listener) { this.listeners.push(listener); }

  emit() { const index = this.current(); this.listeners.forEach((fn) => fn(index)); }
}
