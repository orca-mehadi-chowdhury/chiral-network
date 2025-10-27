# IMPORTANT: This document needs full revision. We don't yet have a reputation system design, which should be a high-priority item.

# Reputation System

Chiral Network implements a comprehensive peer reputation system to ensure reliable file transfers and network quality.

## Overview

The reputation system tracks peer behavior and assigns trust scores based on:
- **Transfer success rate**: Successful vs. failed transfers
- **Latency**: Response time to requests
- **Bandwidth**: Upload/download speeds
- **Uptime**: Time peer has been online
- **Encryption support**: Whether peer supports secure transfers

## Trust Levels

Peers are classified into trust levels based on their composite score:

| Trust Level | Score Range | Description |
|-------------|-------------|-------------|
| **Trusted** | 0.8 - 1.0 | Highly reliable, consistently good performance |
| **High** | 0.6 - 0.8 | Very reliable, above-average performance |
| **Medium** | 0.4 - 0.6 | Moderately reliable, acceptable performance |
| **Low** | 0.2 - 0.4 | Less reliable, below-average performance |
| **Unknown** | 0.0 - 0.2 | New or unproven peers |

## Reputation Metrics

### Composite Score Calculation

The reputation score is calculated using multiple factors:

```typescript
compositeScore = (
  latencyScore * 0.25 +
  bandwidthScore * 0.25 +
  uptimeScore * 0.20 +
  successRateScore * 0.30
)
```

**Weight Distribution**:
- Success Rate: 30% (most important)
- Latency: 25%
- Bandwidth: 25%
- Uptime: 20%

### Individual Metrics

#### 1. Latency Score
- Based on average response time
- Lower latency = higher score
- Measured during peer interactions
- Updated with each transfer

#### 2. Bandwidth Score
- Based on upload/download speeds
- Higher bandwidth = higher score
- Measured in KB/s
- Averaged over multiple transfers

#### 3. Uptime Score
- Percentage of time peer is online
- Calculated from first seen to last seen
- Higher uptime = higher score
- Resets after extended offline periods

#### 4. Success Rate Score
- Successful transfers / total transfers
- Most heavily weighted metric
- Includes both uploads and downloads
- Recent transfers weighted more heavily

## Reputation Features

### Peer Analytics

The Reputation page displays:

- **Total Peers**: Number of known peers
- **Trusted Peers**: Count of highly-rated peers
- **Average Score**: Network-wide average reputation
- **Top Performers**: Leaderboard of best peers
- **Trust Distribution**: Breakdown by trust level

### Filtering & Sorting

**Filter Options**:
- Trust level (Trusted, High, Medium, Low, Unknown)
- Encryption support (Supported / Not Supported / Any)
- Minimum uptime percentage

**Sort Options**:
- By reputation score (highest first)
- By total interactions (most active)
- By last seen (most recent)

### Peer Selection

When downloading files, the system:

1. **Queries available seeders** from DHT
2. **Retrieves reputation scores** for each
3. **Ranks seeders** by composite score
4. **Presents top peers** in selection modal
5. **User can override** automatic selection

### Reputation History

Each peer maintains a history of:
- Reputation score over time
- Recent interactions (last 100)
- Trust level changes
- Performance trends

## Relay Reputation

Peers running as relay servers earn additional reputation:

### Relay Metrics

- **Circuits Successful**: Number of relay connections established
- **Reservations Accepted**: Number of relay reservations granted
- **Bytes Relayed**: Total data relayed for other peers
- **Uptime as Relay**: Time operating as relay server

### Relay Leaderboard

The Reputation page shows top relay nodes:
- Ranked by relay reputation score
- Displays relay-specific metrics
- Shows your node's rank (if running as relay)
- Updates in real-time

### Earning Relay Reputation

To earn relay reputation:

1. **Enable Relay Server** in Settings → Network
2. **Keep node online** with good uptime
3. **Accept reservations** from NAT'd peers
4. **Maintain reliable service** (don't drop circuits)
5. **Monitor your ranking** in Reputation page

## Blacklisting

Users can blacklist misbehaving peers:

### Blacklist Features

- **Manual blacklisting**: Add peer by address
- **Automatic blacklisting**: System flags suspicious behavior
- **Blacklist reasons**: Document why peer was blocked
- **Timestamp tracking**: When peer was blacklisted
- **Remove from blacklist**: Unblock peers

### Blacklist Criteria

Peers may be automatically blacklisted for:
- Repeated failed transfers
- Malformed data
- Protocol violations
- Excessive connection attempts
- Suspicious activity patterns

## Privacy Considerations

### What's Tracked

- Peer IDs (not real identities)
- Transfer statistics
- Connection metadata
- Performance metrics

### What's NOT Tracked

- File content
- User identities
- IP addresses (if using proxy/relay)
- Personal information

### Anonymous Mode

When anonymous mode is enabled:
- Your reputation is still tracked by others
- You can still view others' reputation
- Your peer ID changes periodically
- IP address hidden via relay/proxy

## Using Reputation Data

### For Downloads

1. **Check seeder reputation** before downloading
2. **Prefer Trusted peers** for important files
3. **Monitor transfer progress** from selected peers
4. **Report issues** if peer misbehaves

### For Uploads

1. **Build good reputation** by:
   - Maintaining high uptime
   - Completing transfers reliably
   - Supporting encryption
   - Running as relay server (optional)
2. **Monitor your reputation** in Analytics page
3. **Respond to requests** promptly

### For Network Health

1. **Avoid Low/Unknown peers** for critical transfers
2. **Contribute to network** to build reputation
3. **Report malicious peers** for blacklisting
4. **Help NAT'd peers** by running relay server

## API Access

Developers can access reputation data:

```typescript
import PeerSelectionService from '$lib/services/peerSelectionService';

// Get all peer metrics
const metrics = await PeerSelectionService.getPeerMetrics();

// Get composite score for a peer
const score = PeerSelectionService.compositeScoreFromMetrics(peerMetrics);

// Select best peers for download
const bestPeers = await PeerSelectionService.selectPeersForDownload(
  availableSeederIds,
  minRequiredPeers
);
```

## Troubleshooting

### Low Reputation Score

**Causes**:
- Unreliable connection
- Slow bandwidth
- Frequent disconnections
- Failed transfers

**Solutions**:
- Improve internet connection
- Keep application running
- Don't pause uploads mid-transfer
- Enable encryption support

### Peers Not Showing Reputation

**Causes**:
- New peers (no history)
- DHT not connected
- Reputation service not initialized

**Solutions**:
- Wait for peers to interact
- Check Network page for DHT status
- Restart application

### Reputation Not Updating

**Causes**:
- No recent transfers
- Application not running
- Backend service issue

**Solutions**:
- Perform some transfers
- Check console for errors
- Restart application

## Peer Trust Levels

This section replaces the placeholder Filecoin-style reputation workflow with a concrete trust engine that the Rust backend can enforce and the Svelte UI can surface.

### Goals & Integration
- Fold the existing `src-tauri/src/reputation.rs` placeholder into a reusable trust engine that downstream modules can query for scores and signed audit trails.
- Keep the star-based UI (`src/pages/Network.svelte`, `src/pages/Reputation.svelte`) by mapping the new trust score to a 0–5 display while surfacing textual levels for accessibility.
- Ensure every trust mutation is rooted in verifiable events (Merkle proof failures, payment receipts, DHT telemetry) so that penalties are defensible.

### Score Model & Level Mapping
- **Score range:** `[-1.0, +1.0]` with `0.0` neutral.
- **Levels:** `BANNED ≤ -0.75`, `LOW (-0.75,-0.25]`, `NEUTRAL (-0.25,0.25]`, `HIGH (0.25,0.75]`, `VERIFIED > 0.75`.
- **UI conversion:** `stars = clamp(0.0, 5.0, ((score + 1.0) / 2.0) * 5.0)` stored alongside the textual level so existing badges continue to render.
- **Decay:** exponential toward `0.0` (half-life configurable, default 72h) processed by a background sweeper so that temporary disputes do not permanently scar a peer.
- **Rate limits:** cap positive deltas per peer per trailing window to limit farming and require corroboration for large jumps.

### Evidence Sources & Event Hooks
- **Chunk validation failures** (`src-tauri/src/manager.rs:416`, `src/lib/services/p2pFileTransfer.ts:492`): emit `TrustEvent::InvalidChunk { peer_id, chunk, proof }` when Merkle verification fails or the frontend receives corrupt data twice.
- **Malicious behaviour reports** (`src-tauri/src/dht.rs:6056`, `src-tauri/src/main.rs:3624`, `src/lib/services/peerService.ts:205`): wire the `report_malicious_peer` command to the trust engine so severity drives penalties after on-chain or proof-backed validation.
- **Payment outcomes** (`src-tauri/src/dht.rs:3514`, `src-tauri/src/main.rs:1193`, `src-tauri/src/ethereum.rs`): reward `PaymentSuccess` events tied to the emitter, penalize `PaymentFailure` or missing escrow release when a timeout elapses without matching receipt.
- **Transfer telemetry** (`src-tauri/src/dht.rs:6038`, `record_transfer_success/failure`): convert the existing reliability heuristics into small trust nudges so long-lived, successful peers drift upward.
- **Protocol violations** (`SwarmEvent::ConnectionClosed` causes, `identify` protocol mismatch, `proxy_verify` failures at `src-tauri/src/dht.rs:5844`): emit `TrustEvent::ProtocolViolation` when peers repeatedly disconnect abruptly or spoof capabilities.

### Planned Code Changes (Rust)
- `src-tauri/src/reputation.rs`: refactor into `trust` module exporting `TrustEngine`, `TrustScore`, `TrustLevel`, `TrustEvent`, `TrustLedger`, reusing signing/Merkle helpers but storing canonical score & decay metadata.
- `src-tauri/src/dht.rs`: load `TrustEngine` into `DhtService`, observe events inside swarm handling, gate dials/accepts for `BANNED` peers, and expose new admin Tauri commands (`get_peer_trust`, `adjust_peer_trust`).
- `src-tauri/src/peer_selection.rs`: add `trust_score: f64`, `trust_level: TrustLevel` to `PeerMetrics`, favour higher levels when ranking, and request updates from `TrustEngine` when metrics mutate.
- `src-tauri/src/main.rs`: extend `AppState` to hold `trust: Arc<TrustEngine>`, update commands (`get_peer_metrics`, `report_malicious_peer`, payment handlers) to emit typed `TrustEvent`s, and surface trust metadata in API responses.
- `src-tauri/src/download_scheduler.rs` & `src-tauri/src/multi_source_download.rs`: ensure scheduling prefers peers above the configured minimum level and records trust evidence after each chunk.
- `src-tauri/src/analytics.rs` & telemetry exporters: add metrics `trust_score`, `trust_level_total` for dashboards.

### Planned Code Changes (Svelte)
- `src/lib/services/peerService.ts`: extend `BackendPeerMetrics` to include `trust_score`, `trust_level`, map to star display, and surface enforcement hints in tooltips.
- `src/lib/stores.ts`: persist trust metadata inside `PeerInfo` and new `TrustSummary` store for Reputation page filters.
- `src/pages/Network.svelte` & `src/pages/Reputation.svelte`: render badges (`VERIFIED`, `HIGH`, etc.), add sort/filter by level, and include warning banners when interacting with `LOW` peers.
- `src/pages/Account.svelte` (blacklist UI): wire the “report malicious peer” quick actions to the trust event flow and show when penalties were applied.

### Config & Defaults
```toml
[trust]
enabled = true
half_life_hours = 72
min_level_to_accept = "LOW"
reward = { successful_transfer = 0.01, payment_success = 0.05, heartbeat = 0.005 }
penalty = { invalid_chunk = -0.15, payment_failure = -0.25, malicious_report = -0.5 }
shadow_mode = true
```
- Mirror keys in `AppSettings` (`src/lib/stores.ts`) so the settings UI can toggle enforcement, half-life, and minimum level thresholds.

### Persistence & Migration
- Store trust state in a new `trust.redb` (or similar) file managed by `src-tauri/src/trust/store.rs`, keyed by `PeerId` → `{score: f64, level: TrustLevel, last_update: u64, history_root: String}`.
- Migration steps:
  1. Ship new binary with `trust.enabled=false`, bootstrap DB with neutral entries for all known peers.
  2. Backfill from existing `PeerMetrics` reliability (simple mapping) to seed initial scores.
  3. Keep legacy `ReputationSystem` epoch logic for audit trails until smart-contract anchoring is ready, but mark it deprecated.
- Rollback: delete/backup `trust.redb` and disable the feature flag to fall back to heuristic sorting only.

### Test Plan
- **Unit:** trust math (level thresholds, decay, clamp), serde round-trips for persisted state, payment/chunk event handlers.
- **Integration:** simulated swarm interactions ensuring `BANNED` peers are rejected, successful transfers lift a peer above `NEUTRAL`, corrupt chunk reports trigger penalties only with proof.
- **Adversarial:** Sybil attempts (burst of fake positives), replayed payment receipts, conflicting malicious reports without proof.
- **UI:** Network and Reputation pages render badges consistently, warnings appear for low-trust peers, admin modals display trust history.

## See Also

- [Network Protocol](network-protocol.md) - Peer discovery details
- [File Sharing](file-sharing.md) - Transfer workflows
- [User Guide](user-guide.md) - Using the Reputation page
