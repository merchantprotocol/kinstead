/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Minimal RGBA PNG encoder (zlib from Node) for build-time thumbnails. */
import zlib from 'node:zlib';

export class PngEncoder {
  static CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();

  static crc(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = PngEncoder.CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  static chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(PngEncoder.crc(td));
    return Buffer.concat([len, td, crc]);
  }

  /* rgba: Uint8(Clamped)Array of w*h*4 */
  encode(w, h, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      PngEncoder.chunk('IHDR', ihdr), PngEncoder.chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), PngEncoder.chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}
