## 1. Harden storage chunk responses
- **Why now:** Prevent panics and traversal bugs before adding more integration coverage.
- **Files:** `storage/src/api.rs` (~10 LOC).
- **Acceptance:** Invalid hashes rejected; uploads with clock skew succeed; existing tests still pass.
- **Estimate:** 0.5 day.
- **Risk:** Low.

## 2. Align payment command payloads
- **Why now:** CamelCase payloads silently break backend commands.
- **Files:** `src/lib/services/paymentService.ts` (~12 LOC).
- **Acceptance:** Payment flow succeeds end-to-end; add regression test.
- **Estimate:** 0.5 day.
- **Risk:** Medium.

## 3. Align peer selection invoke payloads
- **Why now:** Backend ignores camelCase keys, skewing metrics and peer choices.
- **Files:** `src/lib/services/peerSelectionService.ts` (~15 LOC).
- **Acceptance:** Strategy commands return expected peers; add unit coverage.
- **Estimate:** 0.5 day.
- **Risk:** Medium.

## 4. Stabilize network event listeners
- **Why now:** Avoid runaway listeners during hot reload.
- **Files:** `src/lib/services/networkService.ts` (~8 LOC).
- **Acceptance:** `startNetworkMonitoring` idempotent; teardown clears listeners (verified in dev tools).
- **Estimate:** 0.25 day.
- **Risk:** Low.

## 5. Fix signed request path canonicalization
- **Why now:** Query signatures currently fail.
- **Files:** `src/lib/services/apiClient.ts` (1 LOC).
- **Acceptance:** Regression test hits signed endpoint with query string successfully.
- **Estimate:** 0.25 day.
- **Risk:** Low.

## 6. Guard Tauri-only initialization
- **Why now:** Web preview mode should not throw on missing Tauri runtime.
- **Files:** `src/lib/services/fileService.ts`, optionally `src/lib/dht.ts` (~8 LOC).
- **Acceptance:** `npm run dev` (browser) logs cleanly; desktop initialization unchanged.
- **Estimate:** 0.25 day.
- **Risk:** Low.

## 7. Correct AutoNAT default & proxy normalization
- **Why now:** Noisy logs and IPv6 failures hamper DHT adoption.
- **Files:** `src-tauri/src/main.rs`, `src-tauri/src/commands/proxy.rs` (~8 LOC).
- **Acceptance:** Standalone DHT starts without AutoNAT warnings; IPv6 proxy connect succeeds.
- **Estimate:** 0.25 day.
- **Risk:** Medium.

## 8. Harden proxy auth token RNG
- **Why now:** Access tokens should use OS entropy.
- **Files:** `src-tauri/src/commands/auth.rs` (~4 LOC).
- **Acceptance:** Tokens remain 64-hex; add simple unit/diagnostic check.
- **Estimate:** 0.25 day.
- **Risk:** Low.

## 9. Handle relay auth response errors
- **Why now:** Relay crashes on invalid clients due to `.unwrap()`.
- **Files:** `relay/src/main.rs` (~4 LOC).
- **Acceptance:** Relay integration test logs errors but keeps running.
- **Estimate:** 0.25 day.
- **Risk:** Low.

## 10. Introduce typed Tauri command wrappers
- **Why now:** Reduce future mismatches between TS and Rust interfaces.
- **Files:** `src/lib/services/*`, new `src/lib/bridge/commands.ts` (~80 LOC).
- **Acceptance:** Services compile with wrapper; unit tests cover wrapper behavior.
- **Estimate:** 0.75 day.
- **Risk:** Medium.

## 11. Service handle guard refactor
- **Why now:** Ensure background tasks terminate cleanly.
- **Files:** `src-tauri/src/main.rs`, `src-tauri/src/file_transfer.rs`, `src-tauri/src/multi_source_download.rs` (~120 LOC).
- **Acceptance:** Graceful shutdown stops pumps; existing integration tests pass.
- **Estimate:** 1.0 day.
- **Risk:** Medium.

## 12. Swap ActiveDownload locks to async
- **Why now:** Remove blocking mutexes inside async workflows.
- **Files:** `src-tauri/src/dht.rs` (~60 LOC).
- **Acceptance:** Download regression test passes; no deadlocks observed.
- **Estimate:** 0.75 day.
- **Risk:** Medium.

