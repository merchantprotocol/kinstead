/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  class MultiplayerHandlerState {
    static attach(handler, multiplayer) {
      return new Proxy(handler, {
        get(target, property, receiver) {
          if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
          const value = multiplayer[property];
          return typeof value === 'function' ? value.bind(multiplayer) : value;
        },
        set(target, property, value, receiver) {
          if (Reflect.has(target, property)) return Reflect.set(target, property, value, receiver);
          multiplayer[property] = value;
          return true;
        }
      });
    }
  }
  G.K.MultiplayerHandlerState = MultiplayerHandlerState;
})(typeof window !== 'undefined' ? window : globalThis);
