| File:Line | Risk | Symptom | Proposed Change | Rationale | Est. Diff |
| --- | --- | --- | --- | --- | --- |
| `src/App.svelte:143` | Medium | Log prints literal `${detection.source}` string | Switch to backtick template literal | Restores useful locale detection telemetry | ~1 |
| `src/lib/services/apiClient.ts:91` | High | Signed path adds extra `?`, breaking signatures | Concatenate `pathname + search` directly | Prevents auth header mismatches on query requests | ~1 |
| `src/lib/services/networkService.ts:12` | Medium | Duplicate event listeners inflate peer counts | Track and dispose unlisten handles | Avoids leaks during hot reload | ~6 |
| `storage/src/api.rs:152` | Medium | `duration_since` unwrap can panic on clock skew | Use `unwrap_or_default()` time fallback | Prevents 500s on clock regressions | ~1 |
| `storage/src/api.rs:279` | High | Accepts arbitrary filenames for chunks | Validate hash (64 hex) before write | Blocks path traversal when storing chunks | ~4 |
| `src-tauri/src/main.rs:947` | Medium | AutoNAT enabled by default despite warning | Default `enable_autonat` to `false` | Matches intended behavior for standalone nodes | ~1 |
| `src/lib/services/signalingService.ts:406` | Medium | Manual disconnect still schedules reconnect | Skip reconnect when `wsClosedByUser` | Prevents reconnect loops on shutdown | ~2 |
| `src/lib/services/proxyLoadBalancer.ts:24` | Low | Sorting mutates caller input array | Clone list before weighting | Protects upstream state from mutation | ~2 |
| `src/lib/services/fileService.ts:14` | Medium | Web preview mode throws invoking Tauri | Return early when Tauri internals missing | Keeps browser dev flow clean | ~4 |
| `src/lib/dht.ts:161` | Medium | AutoNAT probe interval not forwarded | Send `autonat_probe_interval_secs` | Allows tuning probe cadence | ~2 |
| `src/lib/proxy.ts:160` | Low | Remove only filters by `address` | Filter on both `address` and `id` | Ensures proxy entries fully removed | ~2 |
| `src-tauri/src/commands/proxy.rs:48` | Medium | IPv6 proxy strings fail parsing | Handle bracketed/IPv6 host:port | Enables proxy connect for IPv6 peers | ~6 |
| `src-tauri/src/commands/auth.rs:103` | High | Tokens use thread RNG instead of OS entropy | Swap to `rand::rngs::OsRng` | Strengthens proxy auth tokens | ~4 |
| `relay/src/main.rs:323` | Medium | `send_response(...).unwrap()` can panic | Gracefully handle send errors | Keeps relay daemon alive on disconnects | ~4 |
| `src/lib/services/paymentService.ts:193` | High | CamelCase keys sent to Rust command | Rename to snake_case arguments | Allows payment processing to succeed | ~2 |
| `src/lib/services/paymentService.ts:269` | High | Payment notification payload camelCase | Use snake_case keys | Ensures Rust deserializes event | ~6 |
| `src/lib/services/paymentService.ts:388` | Medium | Seeder receipt payload camelCase | Send snake_case keys | Persists seeder receipts correctly | ~4 |
| `src/lib/services/peerSelectionService.ts:49` | High | Recommended peers payload camelCase | Use snake_case request keys | Aligns with Tauri command signature | ~4 |
| `src/lib/services/peerSelectionService.ts:70` | High | Success recorder uses camelCase fields | Send `peer_id`, `duration_ms` | Allows DHT metrics to update | ~4 |
| `src/lib/services/peerSelectionService.ts:88` | High | Failure recorder uses `peerId` | Switch to `peer_id` | Ensures error tracking works | ~2 |
| `src/lib/services/peerSelectionService.ts:124` | High | Strategy payload names mismatched | Use `available_peers`, `require_encryption`, `blacklisted_peers` | Enables backend strategy logic | ~6 |
| `src/lib/services/peerSelectionService.ts:146` | Medium | Encryption support setter uses camelCase | Send `peer_id` | Persists capability flags | ~2 |
| `src/lib/services/peerSelectionService.ts:162` | Medium | Cleanup payload uses camelCase | Send `max_age_seconds` | Allows stale peer pruning | ~2 |

### Diff previews (top 5)

```diff
--- a/storage/src/api.rs
+++ b/storage/src/api.rs
@@
-        let response = ChunkUploadResponse {
-            chunk_hash: calculated_hash,
+        let response = ChunkUploadResponse {
+            chunk_hash: calculated_hash,
             size: body.len(),
             stored_at: std::time::SystemTime::now()
-                .duration_since(std::time::UNIX_EPOCH)
-                .unwrap()
+                .duration_since(std::time::UNIX_EPOCH)
+                .unwrap_or_default()
                 .as_secs(),
         };
@@
-    let file_path = storage_path.join(chunk_hash);
+    if chunk_hash.len() != 64 || !chunk_hash.chars().all(|c| c.is_ascii_hexdigit()) {
+        anyhow::bail!("invalid chunk hash: {chunk_hash}");
+    }
+    let file_path = storage_path.join(chunk_hash);
```

```diff
--- a/src/lib/services/apiClient.ts
+++ b/src/lib/services/apiClient.ts
@@
-    return testUrl.pathname + (testUrl.search ? `?${testUrl.search}` : '');
+    return testUrl.pathname + (testUrl.search || '');
```

```diff
--- a/src/lib/services/paymentService.ts
+++ b/src/lib/services/paymentService.ts
@@
-        await invoke('record_download_payment', {
-          fileHash,
-          fileName,
-          fileSize,
-          seederWalletAddress: seederAddress,
-          seederPeerId: seederPeerId || seederAddress,
-          downloaderAddress: currentWallet.address || 'unknown',
-          amount,
-          transactionId,
-          transactionHash
+        await invoke('record_download_payment', {
+          file_hash: fileHash,
+          file_name: fileName,
+          file_size: fileSize,
+          seeder_wallet_address: seederAddress,
+          seeder_peer_id: seederPeerId || seederAddress,
+          downloader_address: currentWallet.address || 'unknown',
+          amount,
+          transaction_id: transactionId,
+          transaction_hash: transactionHash
         });
```

```diff
--- a/src/lib/services/peerSelectionService.ts
+++ b/src/lib/services/peerSelectionService.ts
@@
-    const peers = await invoke<string[]>("select_peers_with_strategy", {
-      availablePeers,
+    const peers = await invoke<string[]>("select_peers_with_strategy", {
+      available_peers: availablePeers,
       count,
       strategy,
-      requireEncryption,
-      blacklistedPeers: blacklistedAddresses 
+      require_encryption: requireEncryption,
+      blacklisted_peers: blacklistedAddresses 
     });
```

```diff
--- a/src/lib/services/networkService.ts
+++ b/src/lib/services/networkService.ts
@@
-import { listen } from '@tauri-apps/api/event';
+import { listen, type UnlistenFn } from '@tauri-apps/api/event';
@@
-// Set up event listeners for DHT peer connection changes
-export function setupDhtEventListeners(): void {
+let dhtUnlistenFns: UnlistenFn[] = [];
+
+export function setupDhtEventListeners(): void {
+  if (dhtUnlistenFns.length) return;
   // Listen for peer connections
-  listen<{ peer_id: string; address: string }>('dht_peer_connected', () => {
+  listen<{ peer_id: string; address: string }>('dht_peer_connected', () => {
     dhtConnectedPeerCount++;
     console.log(`✅ DHT peer connected. Total connected peers: ${dhtConnectedPeerCount}`);
     updateNetworkStatusFromDht();
-  }).catch((err) => console.error('Failed to listen to dht_peer_connected:', err));
+  })
+    .then((dispose) => dhtUnlistenFns.push(dispose))
+    .catch((err) => console.error('Failed to listen to dht_peer_connected:', err));
@@
-  listen<{ peer_id: string }>('dht_peer_disconnected', () => {
+  listen<{ peer_id: string }>('dht_peer_disconnected', () => {
     dhtConnectedPeerCount = Math.max(0, dhtConnectedPeerCount - 1);
     console.log(`❌ DHT peer disconnected. Total connected peers: ${dhtConnectedPeerCount}`);
     updateNetworkStatusFromDht();
-  }).catch((err) => console.error('Failed to listen to dht_peer_disconnected:', err));
+  })
+    .then((dispose) => dhtUnlistenFns.push(dispose))
+    .catch((err) => console.error('Failed to listen to dht_peer_disconnected:', err));
@@
   return () => {
     console.log('⏹️ Stopping network status monitoring');
     clearInterval(interval);
+    dhtUnlistenFns.forEach((dispose) => dispose());
+    dhtUnlistenFns = [];
   };
 }
```

