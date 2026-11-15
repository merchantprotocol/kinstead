/** One slide: a full-height scrollable page section. Knows its title, icon and how to show or hide itself. */
export class Slide {
  constructor(element, index) {
    this.element = element;
    this.index = index;
    this.title = element.dataset.title || `Slide ${index + 1}`;
    this.thumb = element.dataset.thumb || '';
    this.icon = element.dataset.icon || '';
  }

  show() {
    this.element.hidden = false;
    this.element.classList.add('is-active');
    this.element.scrollTop = 0;
    this.element.setAttribute('aria-hidden', 'false');
    this.element.focus({ preventScroll: true });
  }

  hide() {
    this.element.classList.remove('is-active');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.hidden = true;
  }
}
