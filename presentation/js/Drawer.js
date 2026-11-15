/** The left drawer: lists every slide (number, thumbnail, title), opens one on click, and hides/shows itself. */
export class Drawer {
  constructor(root, list, toggleButton, store) {
    this.root = root;
    this.list = list;
    this.toggleButton = toggleButton;
    this.store = store;
    this.items = [];
    this.selectListeners = [];
    this.toggleButton.addEventListener('click', () => this.toggle());
  }

  render(slides) {
    this.list.innerHTML = '';
    this.items = slides.map((slide) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'drawer-item';
      const visual = slide.thumb
        ? `<img class="drawer-thumb" src="${slide.thumb}" alt="" loading="lazy" decoding="async">`
        : `<span class="drawer-thumb drawer-icon" aria-hidden="true">${slide.icon || '❖'}</span>`;
      button.innerHTML = `<span class="drawer-num">${slide.index + 1}</span>${visual}<span class="drawer-title">${slide.title}</span>`;
      button.addEventListener('click', () => this.selectListeners.forEach((fn) => fn(slide.index)));
      item.appendChild(button);
      this.list.appendChild(item);
      return button;
    });
    this.setOpen(this.store.get('drawer', 'open') === 'open');
  }

  onSelect(listener) { this.selectListeners.push(listener); }

  highlight(index) {
    this.items.forEach((button, i) => {
      const active = i === index;
      button.classList.toggle('is-current', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    const current = this.items[index];
    if (current && this.isOpen()) current.scrollIntoView({ block: 'nearest' });
  }

  isOpen() { return !document.body.classList.contains('drawer-closed'); }

  setOpen(open) {
    document.body.classList.toggle('drawer-closed', !open);
    this.toggleButton.setAttribute('aria-expanded', String(open));
    this.toggleButton.title = open ? 'Hide slides (D)' : 'Show slides (D)';
    this.store.set('drawer', open ? 'open' : 'closed');
  }

  toggle() { this.setOpen(!this.isOpen()); }
}
