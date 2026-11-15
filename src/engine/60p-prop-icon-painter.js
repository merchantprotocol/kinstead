/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;

  /* draws the little prop icons in the Props tool palette */
  class PropIconPainter {
    static PALETTE = {
      campfire: ['#ff8f2e', '#5a1408'], torch: ['#ffc65a', '#30343e'], banner: ['#a8383a', '#47301c'],
      pine: ['#2a4733', '#c6d2e3'], deadtree: ['#4a382a', '#281d16'], shrub: ['#40633a', '#223a22'],
      rock: ['#4c4b52', '#2a2b31'], rubble: ['#605e64', '#dfe7f2'], crate: ['#765333', '#331f13'],
      crates: ['#765333', '#dfe7f2'], pillar: ['#78757a', '#dfe7f2'], log: ['#5c4836', '#dfe7f2'],
    };
    static RESOURCE_ICONS = { ore: 'ore', tree: 'log', herb: 'herb', fish: 'fish' };
    constructor(renderer) { this.renderer = renderer; }
    paintAll(root) { root.querySelectorAll('canvas[data-icon]').forEach((c) => this.paint(c, c.dataset.icon)); }
    paint(canvas, key) {
      const def = K.PropBuilder.PROPS[key], ctx = canvas.getContext('2d');
      if (def.interact && K.Icons) { this.paintResource(ctx, def); return; }
      if (def.sprite) { this.paintSprite(canvas, ctx, def); return; }
      this.paintShape(ctx, key);
    }
    paintResource(ctx, def) {
      const icon = PropIconPainter.RESOURCE_ICONS[def.interact] || 'bag';
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(K.Icons.base(icon), 0, 0, 28, 28);
    }
    paintSprite(canvas, ctx, def) {
      const sprite = this.renderer.lib.get(def.sprite), frame = sprite.frames[0];
      const source = this.renderer.bank.canvasOf(frame), scale = Math.min(28 / frame.w, 28 / frame.h);
      canvas.width = Math.round(frame.w * scale);
      canvas.height = Math.round(frame.h * scale);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    paintShape(ctx, key) {
      const pal = PropIconPainter.PALETTE[key] || ['#888', '#444'];
      ctx.fillStyle = pal[1];
      ctx.fillRect(6, 20, 16, 4);
      ctx.fillStyle = pal[0];
      if (key === 'pine') this.triangle(ctx, [14, 2], [23, 22], [5, 22]);
      else if (key === 'campfire' || key === 'torch') this.triangle(ctx, [14, 4], [20, 20], [8, 20]);
      else if (key === 'banner') { ctx.fillRect(9, 3, 2, 21); ctx.fillRect(11, 4, 9, 13); }
      else if (key === 'pillar') ctx.fillRect(9, 4, 10, 18);
      else ctx.fillRect(7, 9, 14, 12);
    }
    triangle(ctx, a, b, c) {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.fill();
    }
  }
  K.PropIconPainter = PropIconPainter;
})(typeof window !== 'undefined' ? window : globalThis);
