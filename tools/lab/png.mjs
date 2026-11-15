/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* PngImage: a tiny RGBA PNG reader/writer for the Asset Lab reconstruction tools (8-bit, non-interlaced; colour types
   2 RGB and 6 RGBA). Node only, no dependencies. */
import fs from 'node:fs';
import zlib from 'node:zlib';

export class PngImage {
  constructor(w, h, data) { this.w = w; this.h = h; this.data = data || new Uint8ClampedArray(w * h * 4); }

  static read(file) {
    const b = fs.readFileSync(file);
    if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
    let o = 8, w = 0, h = 0, ct = 0, bd = 0, il = 0; const idat = [];
    while (o < b.length) {
      const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), body = b.subarray(o + 8, o + 8 + len);
      if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); bd = body[8]; ct = body[9]; il = body[12]; }
      else if (type === 'IDAT') idat.push(body);
      else if (type === 'IEND') break;
      o += 12 + len;
    }
    if (bd !== 8 || il !== 0 || (ct !== 6 && ct !== 2)) throw new Error(`${file}: unsupported PNG (bit depth ${bd}, colour type ${ct}, interlace ${il})`);
    const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, cur = new Uint8Array(stride), prev = new Uint8Array(stride);
    const img = new PngImage(w, h);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v = row[i];
        if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
        else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
        cur[i] = v & 255;
      }
      for (let x = 0; x < w; x++) { const d = (y * w + x) * 4; img.data[d] = cur[x * bpp]; img.data[d + 1] = cur[x * bpp + 1]; img.data[d + 2] = cur[x * bpp + 2]; img.data[d + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
      prev.set(cur);
    }
    return img;
  }

  write(file) {
    const { w, h, data } = this, raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
    const chunk = (type, body) => { const l = Buffer.alloc(4); l.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]); const c = Buffer.alloc(4); c.writeUInt32BE(PngImage.crc(tb)); return Buffer.concat([l, tb, c]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  }

  static crc(buf) {
    if (!PngImage.T) { PngImage.T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; PngImage.T[n] = c; } }
    let c = -1; for (let i = 0; i < buf.length; i++) c = PngImage.T[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0;
  }

  px(x, y) { const i = (y * this.w + x) * 4, d = this.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
  /* box-filtered RGBA resample to w x h */
  resized(w, h) {
    const out = new PngImage(w, h), sx = this.w / w, sy = this.h / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0]; let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(this.h, Math.ceil((y + 1) * sy)); yy++) for (let xx = Math.floor(x * sx); xx < Math.min(this.w, Math.ceil((x + 1) * sx)); xx++) { const p = this.px(xx, yy); for (let k = 0; k < 4; k++) acc[k] += p[k]; n++; }
      for (let k = 0; k < 4; k++) out.data[(y * w + x) * 4 + k] = acc[k] / Math.max(1, n);
    }
    return out;
  }
}
