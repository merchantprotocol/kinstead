/** Maps keys to deck actions: arrows/PageUp/PageDown to move, Home/End, D to toggle the drawer, F for fullscreen. */
export class KeyboardNav {
  constructor(doc, actions) {
    this.doc = doc;
    this.actions = actions;
    this.doc.addEventListener('keydown', (event) => this.handle(event));
  }

  isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  handle(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || this.isTyping(event.target)) return;
    const map = {
      ArrowRight: 'next', PageDown: 'next', ArrowLeft: 'prev', PageUp: 'prev',
      Home: 'first', End: 'last', d: 'toggleDrawer', D: 'toggleDrawer', f: 'fullscreen', F: 'fullscreen',
    };
    const action = map[event.key];
    if (!action) return;
    event.preventDefault();
    this.actions[action]();
  }
}
