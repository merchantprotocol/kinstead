# Client and server architecture

## Target shape

Keep classic-script loading and the `K` namespace. Files are organized around one owning class; collaborators enter through constructors, and features are attached by composition rather than prototype replacement.

### Client layers

- **Data** (`WorldDoc`, castle data repositories, save codecs): validated state and persistence formats; no DOM or rendering.
- **Domain** (world generation, navigation, castle economy/rules, actors): game rules and state transitions, with no DOM access.
- **Rendering** (`WorldRenderer`, `Chunk`, `TextureBank`, `CameraRig`, actor/building renderers): owns Three.js resources and rendering lifecycle.
- **Application** (`BuilderApp`, `PlayMode`, `CastleGame`): coordinates a session and owns its collaborators; delegates editing, combat, persistence, and multiplayer to focused controllers.
- **UI** (`BuildDrawer`, castle UI, dialogs, inspector): DOM presentation and input routing; invokes application methods through explicit hooks.
- **Infrastructure** (storage adapters, network transport, asset loading): boundary classes injected into application/domain collaborators.

Each feature plugs into the game through a collaborator (for example `CastleGame` composes `CastleTools`, `Economy`, `Multiplayer`, and `CastleInspector`). A feature owns its state and `dispose()` lifecycle. EngineManifest order is dependency order: low-level data and renderer classes first, then application and feature owners.

### Server layers

- **Transport / entry**: the Worker entrypoint validates websocket upgrades and creates or resolves the room.
- **Room application**: one `GameRoom` Durable Object per map owns membership, serialized room state, timers, and message dispatch.
- **Domain services**: focused room services own presence, movement validation, teams, chat, and persistence policies; they receive the room's storage and broadcast ports.
- **Adapters**: Durable Object storage, WebSocket, and Cloudflare alarms are isolated behind the room boundary. Domain behavior remains testable with in-memory adapters.

The server remains authoritative for shared state. Clients send intent; room services validate and broadcast state transitions. No client module directly mutates another feature's internal state.

## Phase 2 split plan (ordered by risk)

1. **`83-castle-game.js` (highest behavior risk)** — `CastleSession` lifecycle/composition; `CastleCombatController` raids and damage; `CastlePieceController` placement and piece state; `CastleInspectionRouter` inspection dispatch. Keep `CastleGame` as a thin facade until call sites migrate.
2. **`115-castle-net.js` (high multiplayer risk)** — `RoomTransport`, `PresenceSync`, `TeamCoordinator`, `RemoteActorRegistry`; inject transport and preserve message contracts.
3. **`60-app.js` (high editor regression risk)** — `BuilderApp` session facade; `EditorInputController`, `EditorHistory`, `EditorOverlay`, `EditorDocumentService`, and `EditorFrameLoop`. Move tool implementations into focused files, retaining `K.BuilderApp` API.
4. **`30-render.js` (high visual/resource risk)** — `WorldRenderer`, `ChunkRenderer`, `PaintWorkerPool`, `GeometryBuilder`, `PropBuilder`, and atmosphere/particle renderers. Transfer ownership of each GPU resource and verify disposal.
5. **`75-building-mesh.js` and `66-characters3d.js` (visual risk)** — split building materials/mesh composition/interior visibility and character atlas/actor-view animation into dedicated renderer classes.
6. **`63-play.js`, `71-building-data.js`, `73-furniture.js`, `82c/82d-art-*.js` (moderate risk)** — session facade vs input, world-document repository/codec, furniture catalog builders, and one art producer class per feature. Keep all generated data owned by a class/config instance.
7. **`120-castle-workers.js` and remaining castle feature files** — worker task scheduler, worker actor presentation, and focused feature services, preserving existing explicit composition boundaries.

The audit command `npm run check:oop` reports current thresholds without gating normal tests; use `--strict` when a staged migration should fail on any remaining threshold violation.
