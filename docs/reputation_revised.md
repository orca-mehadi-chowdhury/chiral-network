# Revised Reputation Model

This document contrasts classic Ethereum’s peer reputation heuristics with the trust-based system we are introducing for Chiral Network. It is written for everyday users (and node runners) so you can understand what earns or costs reputation points and how the new 0–5 star display is derived. The second half dives deep into the implementation so contributors know exactly which files, data structures, and protocols must change.

## 1. Classic Ethereum Peer Reputation

Ethereum’s devp2p protocol does not maintain a global reputation ledger, but mainstream clients (geth, Nethermind, Erigon) run lightweight, local scoring subsystems inspired by Bitcoin Core’s DoS score:

- **Discovery reputation:** discv5 tracks per-node behaviour (responses, timeouts) and exponentially decays the score. Nodes that fail to respond or send malformed packets are temporarily ignored.
- **Protocol validation:** ETH/66, LES, snap sync, and eth/propagate handlers increment a misbehavior counter if peers send invalid headers, bogus transactions, or mismatched chain data. Strong violations trigger an immediate disconnect.
- **Rate limiting:** Geth’s `lesScore` and `snap` download manager use deficit accounting: peers must earn credits by serving data and spend them for requests. Falling below zero throttles or disconnects the peer.
- **Manual bans & pruning:** Operators can issue `admin.addPeer`/`admin.removePeer`, update static peer lists, and allow the client to prune low-quality peers from its local database. No client publishes reputation back to the network; everything is local unless persisted.

Key takeaways:
1. Scores are *heuristic* and *local*, not consensus-driven.
2. Proof-of-stake handles economic penalties at the validator level (slashing), while networking enforces short-lived bans.
3. Decay and rate-limits prevent single events from permanently bricking a peer.
4. Clients routinely prune low-scoring peers, trading visibility for network hygiene.

## 2. Chiral 0–5 Star Trust Model (New)

We retain the Ethereum principles—evidence-based penalties, decay, local storage—but expose them as an explicit 0–5 star rating so you can make informed decisions. Unlike classic clients, we do **not** auto-prune low-trust peers; you keep the full directory and decide who to connect with.

### 2.1 Score Fundamentals

- **Internal score range:** `[-1.0, +1.0]` (neutral = 0.0).
- **Star conversion:** `stars = clamp(0, 5, ((score + 1.0) / 2.0) * 5.0)`.
- **Trust levels:**
  - `BANNED ≤ -0.75` (0.0–0.6 stars)
  - `LOW (-0.75, -0.25]` (0.6–1.9 stars)
  - `NEUTRAL (-0.25, 0.25]` (2.0–3.0 stars)
  - `HIGH (0.25, 0.75]` (3.1–4.4 stars)
  - `VERIFIED > 0.75` (4.5–5.0 stars)
- **Decay:** exponential toward 0.0 with configurable half-life (default 72 hours). Positive or negative scores drift back to neutral unless reinforced.
- **Caps:** each peer can gain or lose at most a configured amount per sliding window to resist Sybil inflation or griefing.

### 2.2 Positive Events (earn reputation)

| Event | Source (code path) | Default delta | Evidence stored |
|-------|--------------------|---------------|-----------------|
| Successful encrypted chunk transfer | `record_transfer_success` in `src-tauri/src/dht.rs:6038`; chunk proof in `src-tauri/src/manager.rs:416` | `+0.01` | Chunk hash + Merkle proof |
| Timely payment received | Payment notification at `src-tauri/src/dht.rs:3514` and Ethereum receipt check | `+0.05` | Tx hash, amount, block number |
| Long-lived session without violations | Background sweeper | `+0.02` every configured period | Connection duration |
| Peer endorsement (manual forgive) | Tauri command `trust_forgive_peer` | Operator-defined (max `+0.1`) | Signed admin action |

Only events with cryptographic or protocol-level evidence are accepted. If a peer cannot provide the proof (chunk hash, payment receipt, signature), the engine rejects the adjustment.

### 2.3 Negative Events (lose reputation)

| Event | Source (code path) | Default delta | Proof required |
|-------|--------------------|---------------|----------------|
| Invalid chunk / checksum mismatch | `src-tauri/src/manager.rs:416`, `src/lib/services/p2pFileTransfer.ts:503` after re-request failure | `-0.15` | Merkle proof or checksum pair |
| Payment failure / unpaid invoice | `src-tauri/src/ethereum.rs` timeout watcher | `-0.25` | Invoice ID, tx hash or absence proof |
| Malicious report (user submitted) | `report_malicious_peer` (`src-tauri/src/main.rs:3624`) | Severity-based (`-0.2` minor → `-0.5` severe) | Signed report + evidence |
| Protocol violation (invalid handshake, spam) | Swarm events in `src-tauri/src/dht.rs:3270` and proxy verifier at `src-tauri/src/dht.rs:5844` | `-0.05` to `-0.2` per offense | Event metadata |
| Excessive rate-limit hits | Download scheduler / proxy QoS | `-0.05` | Scheduler log |

### 2.4 Recovery & Forgiveness

- Decay automatically drifts the score toward 0.0, mirroring Ethereum’s discv5 design. Severe penalties take longer to recover but neutralise over time with honest behaviour.
- Operators can apply *forgiveness* via admin UI/Tauri command, creating a signed ledger entry that offsets part of the debt (capped per day).
- Consistent positive activity (verified payments, clean transfers) outweighs single mistakes; caps prevent rapid 0→5 farming.

### 2.5 Enforcement Modes

| Mode | Behaviour |
|------|-----------|
| Shadow (`trust.enabled=true`, `shadow_mode=true`) | Scores calculated and logged; UI displays stars, but networking acts as before. Use to validate weights. |
| Soft (`min_level_to_accept="LOW"`) | Low-trust peers trigger warnings and throttled bandwidth, but users can override. |
| Hard (`min_level_to_accept="NEUTRAL"` or higher) | `BANNED` peers are refused; `LOW` peers may require escrow or manual approval. |

### 2.6 Identity, Integrity, and Distribution

- **Stable Peer IDs:** Reputation only works if identities persist. Chiral derives the libp2p `PeerId` from a long-lived Ed25519 key stored in the local keystore (or generated deterministically from the user’s seed). Restarting or going offline does not change this key, so your trust history follows you when you reconnect.
- **Signed Events:** Every `TrustEvent` is signed by the reporting node’s key (and, for payment events, backed by an Ethereum transaction hash). Peers ignore unsigned or unverifiable reports.
- **Merkle Ledger:** The trust engine maintains a Merkle tree (inherited from `reputation.rs`) so batches of events can be committed with a single root hash. This mirrors Ethereum’s slashing proofs—tampering with a past event invalidates the Merkle proof.
- **DHT Replication:** To keep data distributed, each peer publishes its latest trust snapshot under a dedicated Kademlia namespace (e.g., `trust/<peer_id>`). Records include the signed score, level, last-update timestamp, and Merkle root so anyone can audit the path.
- **Gossip Hygiene:** Nodes cache recent snapshots but never overwrite local evidence unless signatures validate. This prevents a malicious peer from downgrading someone else’s score without proof.
- **Future anchoring:** When ready, the Merkle roots can be anchored on-chain (or in a shared side channel) for long-term arbitration, but day-to-day decisions remain lightweight and DHT-based.

## 3. Operator FAQ

**How do I improve my node’s stars?** Keep payments timely, serve correct chunks, stay online, and avoid sudden disconnects. Positive events accumulate gradually.

**What happens after a false report?** Provide evidence (chunk hash, payment receipt). An admin can forgive the penalty; the ledger stores that action, and future decay helps restore the score.

**Can I reset my reputation?** Scores persist locally (`trust.redb`). Wiping the database resets your view but other peers retain their record, so reputation follows you.

**Will this publish my behaviour on-chain?** Not yet. The ledger stays local but can be optionally anchored via the existing Merkle framework for arbitration.

**Why 0–5 stars?** Most users understand stars faster than raw floats. Internally we still work with `[-1,1]`, keeping a precise audit trail.

**Will the system hide peers from me?** No. Scores inform decisions but we keep historical entries—even low-trust ones—so you retain full freedom of choice.

**How do I know the scores aren’t tampered with?** Trust snapshots are signed, Merkle-rooted, and distributed through the DHT. Peers verify signatures and proofs before accepting updates, so forged data is rejected.

## 4. Next Steps

- Finalise weight constants in `config/trust.toml` and expose them via `AppSettings`.
- Implement the `TrustEngine` module (`src-tauri/src/trust/`) with unit tests covering each event type and decay.
- Update UI components to show stars, levels, and recent trust events so peers can monitor their status.

For a deeper implementation walkthrough, see `docs/reputation.md#Peer Trust Levels` and ADR `docs/adr/2024-10-27-peer-trust-levels.md`.

## 5. Implementation Blueprint (Deep Dive)

This section enumerates the concrete modules, data formats, and flows required to implement the trust system. It is intentionally detailed so multiple contributors can work in parallel without clashing.

### 5.1 Module Map

- **`src-tauri/src/trust/mod.rs`** (new): core scoring engine with public API `TrustEngine`, `TrustEvent`, `TrustLevel`, `TrustScore`, `TrustSnapshot`.
- **`src-tauri/src/trust/store.rs`** (new): persistence layer backed by Redb (`trust.redb`) with helper for migrations and crash-safe writes.
- **`src-tauri/src/trust/merkle.rs`** (new or moved from `reputation.rs`): Merkle tree utils for hashing event batches.
- **`src-tauri/src/main.rs`**: load `TrustEngine` into `AppState`, expose Tauri commands (`get_peer_trust`, `trust_forgive_peer`, `trust_override_level`).
- **`src-tauri/src/dht.rs`**: emit trust events from libp2p behaviour (`SwarmEvent` handlers, file transfer routines) and publish snapshots to the DHT.
- **`src-tauri/src/peer_selection.rs`**: augment `PeerMetrics` with trust metadata and modify selection heuristics.
- **`src/lib/services/peerService.ts`** and **`src/lib/stores.ts`**: consume new trust fields and surface them in the UI.
- **`src/pages/Network.svelte` / `src/pages/Reputation.svelte`**: render badges, filters, and evidence history.
- **`tests/trust/`** (Rust integration tests) + **`src/lib/__tests__/trust.spec.ts`** (if using Vitest) to verify event->score updates.

### 5.2 Event Pipeline

1. **Evidence collection**
   - Successful transfer (`DhtService::record_transfer_success`) constructs `TrustEvent::TransferSuccess` with bytes, duration, chunk hash reference.
   - Invalid chunk detection (`verify_chunk_with_proof` failure or frontend `validateChunk`) sends `TrustEvent::InvalidChunk { merkle_proof, chunk_hash }`.
   - Payment watcher in `src-tauri/src/ethereum.rs` raises `TrustEvent::PaymentSettled` or `TrustEvent::PaymentDefault`.
   - User reports via `report_malicious_peer` (now `trust_report_malicious_peer`) wrap the submitted proof bundle.

2. **Event submission**
   ```rust
   // src-tauri/src/dht.rs (pseudocode)
   if let Some(engine) = self.trust_engine.as_ref() {
       if let Err(err) = engine.observe(event).await {
           warn!(?err, "failed to record trust event");
       }
   }
   ```

3. **Scoring & decay**
   - `TrustEngine::observe` computes `delta = weight(event)` and adds it to score, clamped within configured per-period caps.
   - `TrustEngine::apply_decay(now)` called by a Tokio interval task (e.g., every 10 minutes) to slide score toward 0.0.

4. **Persistence**
   - Engine writes `TrustSnapshot` (`score`, `level`, `last_event`, `history_root`, `stars`) to `trust.redb` with journaling semantics.
   - Snapshots include `signature = sign(snapshot_bytes, local_signing_key)` to authenticate distribution.

5. **Distribution**
   - `DhtService` publishes snapshot JSON via Kademlia `PUT` on key `trust:<peer_id>` with TTL (e.g., 1 hour). TTL ensures stale data eventually expires.
   - Peers fetching snapshots verify the signature and Merkle root before ingesting.

6. **UI consumption**
   - `get_peer_metrics` command returns each peer’s metrics plus trust data. Frontend stores convert to stars and tooltips.

### 5.3 Data Structures

```rust
// src-tauri/src/trust/types.rs
#[derive(Serialize, Deserialize, Clone)]
pub struct TrustEvent {
    pub peer_id: String,
    pub kind: TrustEventKind,
    pub weight: f64,
    pub evidence: TrustEvidence,
    pub observed_at: i64,
}

pub enum TrustEventKind {
    TransferSuccess,
    InvalidChunk,
    PaymentSettled,
    PaymentDefault,
    MaliciousReport,
    ProtocolViolation,
    ManualForgive,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TrustSnapshot {
    pub peer_id: String,
    pub score: f64,
    pub level: TrustLevel,
    pub stars: f32,
    pub last_event: Option<TrustEventKind>,
    pub last_update: i64,
    pub history_root: String,
    pub signature: Vec<u8>,
}
```

Backend code should separate the enum definition (`TrustEventKind`) from weighting tables so the config file can tweak weights without recompiling.

### 5.4 Weight Tables & Config

- File: `config/trust.toml` (new). Loaded by `TrustEngine::from_config` at startup.

```toml
[trust]
half_life_hours = 72
positive_cap_per_hour = 0.10
negative_cap_per_hour = 0.30

[trust.weights]
transfer_success = 0.01
invalid_chunk = -0.15
payment_settled = 0.05
payment_default = -0.25
malicious_report_minor = -0.20
malicious_report_moderate = -0.35
malicious_report_severe = -0.50
protocol_violation = -0.05
manual_forgive = 0.05
```

- Frontend exposes the same defaults under `AppSettings.trust` so advanced users can inspect or override via Settings UI.

### 5.5 DHT Storage Format

- Namespace: `/chiral/trust/1.0.0` (libp2p record key prefix).
- Record key: `trust:<peer_id>`.
- Record value: canonical JSON:

```json
{
  "peer_id": "12D3KooW...",
  "score": 0.42,
  "level": "HIGH",
  "stars": 3.95,
  "last_update": 1730001123,
  "history_root": "abc123...",
  "signature": "base64-..."
}
```

- Signature: Ed25519 signature over `blake3(json_without_signature)`.
- Verification flow:
  1. Fetch record.
  2. Extract signer `PeerId` → verifying key.
  3. Recompute digest, verify signature.
  4. Check `history_root` matches local Merkle tree if events available (optional but recommended).
  5. Accept snapshot if `last_update` is newer than local copy.

### 5.6 Backend Integration Points

- **AppState wiring** (`src-tauri/src/main.rs:204`): add `trust: Arc<TrustEngine>` and spawn `trust_decay_task` (Tokio interval) plus `trust_snapshot_publisher`.
- **Tauri commands** (`src-tauri/src/main.rs`):
  - `get_peer_trust(peer_id) -> TrustSnapshot`.
  - `trust_forget_peer(peer_id)` (admin diagnostic).
  - `trust_report_malicious_peer(peer_id, payload)` replacing the current `report_malicious_peer`.
- **DHT hooks**: inside `SwarmEvent::ConnectionEstablished`, call `trust_engine.bootstrap_peer(peer_id)` to ensure a snapshot exists before scoring.
- **Chunk validation**: `verify_chunk_with_proof` returns structured errors consumed by trust engine; duplicate penalties prevented by dedup cache keyed on `(peer_id, chunk_hash)`.
- **Payment watcher**: `src-tauri/src/ethereum.rs` exports channel `payment_notifications`. Handler converts to trust events with the transaction hash as evidence.

### 5.7 Frontend Changes

- **Stores** (`src/lib/stores.ts`):
  ```ts
  export interface PeerInfo {
    // existing fields...
    trustScore: number;   // -1.0..1.0
    trustStars: number;   // 0..5
    trustLevel: 'BANNED' | 'LOW' | 'NEUTRAL' | 'HIGH' | 'VERIFIED';
    trustLastUpdate?: number;
  }
  ```
- **Service** (`src/lib/services/peerService.ts`): adapt `transformBackendMetricsToPeerInfo` to map trust data and supply fallback (`0` score → 2.5 stars) when missing.
- **Components**:
  - `src/lib/components/reputation/TrustBadge.svelte`: renders stars, textual level, and optional tooltip with last event.
  - `src/pages/Network.svelte`: add filters (e.g., “show high-trust only”) and highlight low-trust peers in lists.
  - `src/pages/Reputation.svelte`: display event history timeline using data fetched from new Tauri command `get_peer_trust_events(peer_id)` (optional advanced API).
- **Settings UI** (`src/pages/Settings.svelte`): new section “Trust & Reputation” toggling `shadow_mode`, `min_level_to_accept`, etc.

### 5.8 Testing Strategy

- **Unit (Rust)**:
  - `trust_engine_tests.rs`: verify weight application, decay, caps, serialization, signature validation.
  - `trust_store_tests.rs`: simulate crash recovery (write + reload) to ensure durability.
- **Integration (Rust)**:
  - Scenario: two peers, one serving clean chunks, one serving corrupt; ensure trust diverges appropriately and DHT record updates propagate.
  - Scenario: payment success/failure pipeline with mocked Ethereum responses.
- **Frontend (Vitest/Playwright)**:
  - Assert star rendering matches backend payload.
  - Ensure low-trust warning modals appear when selecting a risky peer for downloads.

### 5.9 Security Considerations

- **Replay protection:** include monotonic `last_update` timestamp and reject snapshots older than current.
- **Sybil resistance:** rely on cryptographic evidence (payments, proofs). Optionally tie positive events to stake deposits in future iterations.
- **Privacy:** trust events reference chunk hashes (not raw data) and payment txids; avoid leaking personal data. Users can opt out of publishing trust snapshots (`trust.publish=false`), though others may still track history locally.
- **DoS mitigation:** cap the number of trust events processed per peer per hour. Validate payload sizes before signature verification.

### 5.10 Migration Plan

1. Ship new binaries with trust engine disabled (`trust.enabled=false`).
2. On first run, migrate any legacy `ReputationEvent` history into `TrustEvent` if present (optional).
3. Start recording events in shadow mode; expose stars read-only in UI.
4. After observing metrics, enable soft enforcement via config update.
5. Communicate to users how to persist their key so PeerId remains stable; include instructions in onboarding flow.

### 5.11 Open Questions

- How often should snapshots be republished to the DHT? (Proposal: every 15 minutes or on score change greater than 0.05.)
- Should negative events include encrypted payloads to preserve privacy? (TBD.)
- Do we need multi-signer endorsements (e.g., escrow contract verifying payment) before giving large positive weight? (Design placeholder.)

Contributors should coordinate via the issue tracker using these sections as acceptance criteria. Cross-reference the ADR and `docs/reputation.md` when implementing to ensure documentation and code stay aligned.
