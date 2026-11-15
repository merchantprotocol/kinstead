/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Furniture catalogue assembly. Geometry and category builders are separate classes. */
(function (G) {
  const K = G.K;
  class FurnitureCatalog {
    constructor(builders = []) {
      this.entries = Object.assign({}, ...builders.map((Builder) => new Builder().build()));
    }
    types() { return Object.keys(this.entries); }
    def(type) { return this.entries[type] || null; }
    interactive() {
      return Object.entries(this.entries).filter(([, item]) => item.interact)
        .map(([type, item]) => ({ type, name: item.name, ...item.interact }));
    }
    groups() {
      const groups = {};
      for (const [type, item] of Object.entries(this.entries)) {
        (groups[item.group] = groups[item.group] || []).push(type);
      }
      return groups;
    }
  }
  const Furniture = new FurnitureCatalog([
    K.BedroomFurnitureBuilder,
    K.ArmoryFurnitureBuilder,
    K.KitchenFurnitureBuilder,
    K.SmithyFurnitureBuilder,
    K.StableFurnitureBuilder,
    K.StudyFurnitureBuilder,
    K.DecorFurnitureBuilder,
    K.BakeryFurnitureBuilder,
    K.ShopsFurnitureBuilder,
    K.ButcherFurnitureBuilder,
    K.AlchemistFurnitureBuilder,
    K.MarketGoodsFurnitureBuilder
  ]);
  Object.assign(K, { FURNITURE: Furniture.entries, FurnitureCatalog, SignIcons: K.FurnitureSigns });
})(typeof window !== 'undefined' ? window : globalThis);
