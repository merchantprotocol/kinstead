/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* PanelText: small text helpers shared by the building panel's sections. */
(function (G) {
  const K = G.K;

  class PanelText {
    static escape(value) {
      const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return String(value == null ? '' : value).replace(/[&<>"]/g, (character) => replacements[character]);
    }

    /** one labelled line; the value is already HTML */
    static row(label, value) {
      return `<div class="ci-row"><span>${PanelText.escape(label)}</span><b>${value}</b></div>`;
    }

    /** "3 Wood, 2 Stone" (or the fallback when empty) */
    static amounts(map, fallback) {
      const parts = Object.entries(map).map(([res, n]) => `${n} ${K.CastleData.resName(res)}`);
      return parts.join(', ') || fallback || '';
    }
  }

  K.PanelText = PanelText;
})(typeof window !== 'undefined' ? window : globalThis);
