## Workspace Layout
- Rust crates: `src-tauri/Cargo.toml` (desktop core), `storage/Cargo.toml` (warp storage API), `relay/Cargo.toml` (libp2p relay). Each crate maintains its own `Cargo.lock`; there is no root `[workspace]`.
- `src-tauri/src/lib.rs` re-exports core modules so integration tests (`src-tauri/tests/*.rs`) can target individual services.
- Large binary fixtures live under `tests/sample-files/` and should remain read-only.

## Desktop & Frontend Structure
- `src-tauri/tauri.conf.json` wires Vite builds (`beforeDevCommand`, `beforeBuildCommand`) and points `frontendDist` to `../dist`. Bundling config lists platform-specific icons.
- `src-tauri/capabilities/default.json` grants broad permissions (notably `"fs:scope": "**"`) and enables OS, shell, dialog, and store plugins.
- `src/App.svelte` mounts the entire router using `@mateothegreat/svelte5-router` with page components in `src/pages/`; shared services and stores reside in `src/lib/`.
- Build tooling: `vite.config.ts` (port 1420, `$lib` alias), `tailwind.config.js`, `postcss.config.js`, and `svelte.config.js` with `vitePreprocess`.
- TypeScript setup: `tsconfig.json` extends `@tsconfig/svelte` with strict options; `vitest.config.ts` targets `tests/**/*.{test,spec}.{ts,js}` with a Node environment.

## Build & Test Entrypoints
- NPM scripts: `dev` (Vite), `tauri:dev`, `tauri:build`, `check` (tsc), `build` (Vite), `test`/`test:watch` (Vitest).
- Rust commands: `cargo check` / `cargo test` within `src-tauri/`; `storage/` provides `cargo run --bin storage-node`; `relay/` builds the standalone circuit relay and runs `cargo test --release --no-fail-fast`.
- GitHub Actions (`.github/workflows/test.yml`): `frontend` job (Node 22, `npm ci`, `npm run check || true`, `npm run build`), `backend` job (downloads built frontend, installs Tauri dependencies, runs `cargo check --workspace`), `relay` job (`cargo test` with `continue-on-error: true`).
- No dedicated `clippy` or `rustfmt` steps in CI; lint failures are tolerated.

## Key Configs & Feature Flags
- `src-tauri/Cargo.toml` enables Tauri features (`macos-private-api`, `tray-icon`, plugin set) and default feature `custom-protocol`.
- `.cargo/config.toml` sets `rust-lld.exe` as the linker for `x86_64-pc-windows-msvc`.
- `src-tauri/build.rs` simply calls `tauri_build::build()`.
- No `.env` files are provided; runtime configuration relies on defaults and local storage.
- Generated capability schemas live under `src-tauri/gen/schemas/`.

## Dependency Hotspots
- Rust import hubs: `src-tauri/src/dht.rs` (~68 imports, ~6.8k LOC), `src-tauri/src/main.rs` (~64 imports, ~5.1k LOC), `src-tauri/src/webrtc_service.rs` (~29), `src-tauri/src/manager.rs` (~20), `storage/src/api.rs` (~15).
- Frontend heavy hitters: `src/pages/Account.svelte` (~2.3k LOC), `src/pages/Network.svelte` (~2.2k), `src/pages/Download.svelte` (~2k), plus `src/lib/components/download/DownloadSearchSection.svelte`.
- Crates rely on `libp2p` 0.54 with extensive features (kad, mdns, noise, quic, request-response, autonat, dcutr), `ethers` 2.0, `beetswap`, `tokio` full, `async-std`, `warp`, `webrtc` 0.10, etc. Any upgrades must respect feature compatibility.

## Async Boundaries
- `AppState` (src-tauri/src/main.rs:204) stores numerous `tokio::sync::Mutex` fields and spawns background pumps for file transfer and multi-source downloads; several spawns drop `JoinHandle`s.
- `ActiveDownload` (src-tauri/src/dht.rs:4750) wraps `memmap2::MmapMut` in `std::sync::Mutex`, causing blocking locks inside async workflows.
- Frontend services (`src/lib/services/signalingService.ts`, `src/lib/services/networkService.ts`) mix async logic with manual timers; repeated initialization can register duplicate listeners.

## Tauri Command Map
- `tauri::generate_handler!` in `src-tauri/src/main.rs:4095` exposes ~90 commands spanning Ethereum account management, mining control, DHT lifecycle, file transfer, multi-source downloads, proxy management, analytics, 2FA, WebRTC signalling, proof-of-storage watchers, and proxy auth token management.
- Commands typically return `Result<T, String>` and expect snake_case payload keys; several long-running tasks execute directly within handlers.

## Libp2p Swarm & DHT Layers
- `DhtService::new` (`src-tauri/src/dht.rs:4928`) composes Kademlia, Bitswap (`beetswap`), request-response protocols (proxy, WebRTC signalling, key exchange), AutoNAT v2 (client/server), AutoRelay, optional relay server, DCUtR, and optional mDNS. Transport uses tokio TCP plus relay client with noise/yamux multiplexing.
- Proxy routing is orchestrated by `ProxyManager`, tracking targets/capable/online peers and `PrivacyMode`.
- File distribution leverages `ActiveDownload` (mmap temp files, chunk offsets), heartbeat caches, and `FileMetadata` caches.

## Risky Folders / Generated Content
- `src-tauri/gen/schemas/` — generated JSON schemas.
- `node_modules/`, `dist/` — checked-in dependencies/builds; avoid manual edits.
- `tests/sample-files/*.bin` — large binary fixtures.
- `src-tauri/target/`, `relay/target/` — build artifacts (ignored).
- `src-tauri/capabilities/default.json` — broad permissions; scrutinize before production.

