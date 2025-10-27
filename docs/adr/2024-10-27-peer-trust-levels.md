# ADR 2024-10-27 – Peer Trust Levels

## Status
Proposed – pending implementation of the trust engine described in `docs/reputation.md#peer-trust-levels`.

## Context
- The current `src-tauri/src/reputation.rs` module mirrors a Filecoin-style reputation ledger but never feeds into `DhtService`, `PeerSelectionService`, or the UI’s enforcement logic.
- `PeerMetrics` already collects success/failure data, and the UI expects a 0–5 reputation score, yet penalties are manual and transient (in-memory only).
- We must support verifiable downgrades (invalid chunks, unpaid transfers) and gradual recovery while keeping the system pluggable with on-chain attestations in the future.

## Decision
- Refactor the reputation module into a `TrustEngine` that emits deterministic scores (`TrustScore`) and levels (`TrustLevel`) and persists state in a lightweight local store (`trust.redb`).
- Integrate the engine with `DhtService` so that libp2p events (`SwarmEvent::ConnectionEstablished/Closed`, proxy verification, payment messages) feed `TrustEvent`s, and connection policy respects minimum trust levels.
- Augment `PeerSelectionService` and Tauri commands (`get_peer_metrics`, `report_malicious_peer`, payment handlers) to consume the authoritative trust data instead of deriving ad-hoc reputation numbers.
- Keep the UI’s star representation by normalising the trust score server-side and transporting both the raw score and level to Svelte clients.

## Alternatives Considered
1. **Maintain the existing placeholder reputation ledger.** Rejected because it offers no enforcement hooks, stores data only in memory, and cannot justify penalties to users.
2. **Delegate trust entirely to smart contracts or external oracles.** Deferred: on-chain anchoring remains desirable, but requiring blockchain connectivity for every trust lookup would block offline-first behaviour and slow feedback.
3. **Per-session heuristic scoring only.** Rejected: without persistence, malicious peers could reconnect to reset their history, and users would have no audit trail for disputes.

## Consequences
- Requires new persistence and periodic decay jobs in the Rust backend; unit/integration coverage must be added to avoid regressions.
- Legacy reputation API consumers must migrate to the new trust payloads; temporary compatibility shims will be required in `PeerMetrics` serialization.
- Introducing enforcement gates mandates a staged rollout (shadow → soft → hard) with observability to detect false positives.
