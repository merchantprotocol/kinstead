/** Toggles browser fullscreen for the whole deck. */
export class Fullscreen {
  constructor(doc) { this.doc = doc; }

  toggle() {
    if (this.doc.fullscreenElement) return this.doc.exitFullscreen();
    const root = this.doc.documentElement;
    return root.requestFullscreen ? root.requestFullscreen().catch(() => {}) : undefined;
  }
}
