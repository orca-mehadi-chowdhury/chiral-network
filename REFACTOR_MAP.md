## Async Correctness
- **Service handle guard**
  - Scope: `src-tauri/src/main.rs`, `src-tauri/src/file_transfer.rs`, `src-tauri/src/multi_source_download.rs`.
  - Preconditions: Background services already wrapped in `Arc`.
  - Steps: Introduce a small helper struct that owns `JoinHandle`s, replace raw `tokio::spawn` calls with helper `spawn` that stores handles; ensure `Drop` aborts lingering tasks.
  - Tests: `src-tauri/tests/analytics_integration_test.rs`, `src-tauri/tests/download_source_test.rs`.
  - Rollback: Restore prior `JoinHandle<Option>` fields in `AppState`.

- **Async-friendly ActiveDownload locks**
  - Scope: `src-tauri/src/dht.rs`.
  - Preconditions: Confirm `MmapMut` can live behind `tokio::sync::Mutex`.
  - Steps: Replace `std::sync::Mutex` with `tokio::sync::Mutex`, update call sites to `.lock().await`, adjust imports.
  - Tests: `src-tauri/tests/nat_traversal_e2e_test.rs`, `src-tauri/tests/hmac_auth_test.rs`, `src-tauri/tests/metadata_ftp_source_test.rs`.
  - Rollback: Revert lock types and remove introduced `.await`.

## Error Handling
- **Chunk/storage error contexts**
  - Scope: `storage/src/api.rs`, plus any `src-tauri` call sites referencing the storage node.
  - Preconditions: Small fixes applied (hash validation, timestamp unwraps).
  - Steps: Replace `unwrap`/`expect` paths with `with_context`, propagate errors into structured JSON responses, add `tracing` logs for failures.
  - Tests: `storage/src/api.rs` unit tests (existing), integration test using `warp::test`.
  - Rollback: Restore simple error handling with direct replies.

- **Payment pipeline diagnostics**
  - Scope: `src-tauri/src/main.rs` (payment-related commands), `src/lib/services/paymentService.ts`.
  - Preconditions: Payload naming fixes merged.
  - Steps: Define a Rust `enum PaymentError` mapping to HTTP codes; convert frontend to handle discriminated unions; improve logging for both download and seeder paths.
  - Tests: `tests/transactions.test.ts`, `tests/reputation-persistence.test.ts`, `src-tauri/tests/analytics_integration_test.rs`.
  - Rollback: Return to string-based error paths on both sides.

## Type Safety
- **Typed command wrappers**
  - Scope: `src/lib/services/*.ts`, new module `src/lib/bridge/commands.ts`.
  - Preconditions: Snake_case payload alignment completed.
  - Steps: Implement a typed `invokeCommand<TReq, TRes>()` helper enforcing snake_case keys; refactor services to call the wrapper; share request/response types (manual or via generated DTOs).
  - Tests: `tests/dhtHelpers.test.ts`, `tests/proxyRouting.test.ts`, TypeScript build (`npm run check`).
  - Rollback: Replace wrapper usage with direct `invoke`.

- **Shared metadata DTO**
  - Scope: `src-tauri/src/dht.rs`, `src/lib/dht.ts`, `src/lib/services/p2pFileTransfer.ts`.
  - Preconditions: Frontend and backend use consistent field names.
  - Steps: Extract `FileMetadata` into a dedicated Rust module, export via `serde`; introduce shared TypeScript type (manual or generated). Update serialization sites to rely on the shared definition.
  - Tests: `tests/multi-source-download.test.ts`, `tests/uploadHelpers.test.ts`, `src-tauri/tests/orchestrator_ftp_integration_test.rs`.
  - Rollback: Revert to current ad-hoc structs/interfaces.

## Boundary Separation
- **Proxy subsystem split**
  - Scope: `src-tauri/src/commands/proxy.rs`, `src-tauri/src/net/proxy_server.rs`, `src/lib/proxy.ts`, `src/lib/services/proxyLatencyOptimization.ts`.
  - Preconditions: IPv6 and normalization fixes merged.
  - Steps: Move normalization and state helpers into `net::proxy`; expose a typed event API; front-end consumes typed events rather than raw `ProxyUpdate`.
  - Tests: `tests/proxyRouting.test.ts`, manual proxy connect smoke test.
  - Rollback: Inline helper back into `commands/proxy.rs`.

- **Payment events module**
  - Scope: `src-tauri/src/main.rs`, new `src-tauri/src/payments.rs`, `src/lib/services/paymentService.ts`.
  - Preconditions: Payload naming alignment landed.
  - Steps: Create module encapsulating payment event emission/recording; update `AppState` to expose only necessary handles; point TypeScript service to the streamlined command surface.
  - Tests: `tests/transactions.test.ts`, `tests/mining.test.ts` (wallet balance checks).
  - Rollback: Remove module and re-inline functions into `main.rs`.

