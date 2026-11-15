/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  class PanelText {
    static escape(value) {
      const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return String(value == null ? '' : value).replace(/[&<>"]/g, (character) => replacements[character]);
    }
  }
  G.K.PanelText = PanelText;
})(typeof window !== 'undefined' ? window : globalThis);
