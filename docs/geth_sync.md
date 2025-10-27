# Geth Peer Synchronization Architecture

This document explains how the Chiral desktop application currently launches its private Ethereum-compatible network and what additional steps are required so that every participant tracks the same ledger. Today the Tauri backend automatically spawns a Geth process for each user (via the `start_geth_node` command in `src-tauri/src/main.rs`), points the wallet code at `http://127.0.0.1:8545`, and assumes the user’s node is the whole chain. To make this behave like a real shared network—where the longest valid chain wins—we must extend the existing flow with proper bootstrapping and peer connectivity.

---

## 1. Current auto-launch behavior

- The Svelte frontend calls `start_geth_node` (see `src/lib/services/gethService.ts`), which in turn starts the bundled Geth binary with default arguments (network ID `98765`, RPC bound to `127.0.0.1:8545`).
- The data directory lives under the user’s app data path (`~/.chiral/geth-data` on desktop platforms).
- No bootnodes are passed; discovery is effectively limited to localhost, so each user runs a private chain.

To move beyond this, we keep the auto-launch but add bootnode configuration so every local node connects to the shared network.

---

## 2. Shared chain specification (already in place)

- `genesis.json` in the repo defines the chain ID, consensus (Ethash PoW), and premine.
- `start_geth_node` already ensures the data directory is initialized with this genesis if it doesn’t exist.
- Changing the chain ID requires updating both `genesis.json` and the hard-coded constant in `src-tauri/src/ethereum.rs`.

No code changes are needed here; we simply rely on the existing initialization.

---

## 3. Always-on bootstrap / miner node (recommended)

While not strictly mandatory for a proof-of-concept, having at least one publicly reachable Geth node stabilizes the network. This host should:

1. Run the shared genesis/chain ID.
2. Listen on TCP+UDP port `30303` (open in firewalls/security groups).
3. Optionally expose JSON-RPC / WS for debugging (bind to `0.0.0.0` only if secured).

Example invocation on a cloud host:
```bash
geth --datadir ./bootnode \
     --networkid 98765 \
     --port 30303 \
     --http --http.addr 0.0.0.0 --http.api eth,net,web3 \
     --ws --ws.addr 0.0.0.0 --ws.api eth,net,web3
```

Capture its enode URI (required for clients):
```bash
geth attach ./bootnode/geth.ipc --exec admin.nodeInfo.enode
# Example: enode://<pubkey>@203.0.113.10:30303?discport=30303
```

This node does not need to mine, but keeping one miner online ensures liveness. Additional miners can be ordinary desktops running `--mine`.

---

## 4. Updated client launch flow (`start_geth_node`)

Current code path (no changes yet):

```rust
// src-tauri/src/main.rs
invoke("start_geth_node", { dataDir, rpcUrl? })
```

Enhancements to implement:

1. **Bootnode list** — Extend the command to accept `bootnodes: Vec<String>` (or resolve them internally via config/DHT).
2. **Geth args** — Include `--bootnodes`, ensure discovery stays enabled, and keep RPC bound to localhost for wallet usage.

Example target command once enhanced:
```bash
geth --datadir <DATA_DIR> \
     --networkid 98765 \
     --port 30303 \
     --bootnodes enode://<bootnode>@host:30303 \
     --http --http.addr 127.0.0.1 --http.api eth,net,web3,personal \
     --ws --ws.addr 127.0.0.1 --ws.api eth,net,web3 \
     --allow-insecure-unlock
```

If the user is behind NAT, the outbound connection to the bootnode is sufficient; inbound peering can be optional.

Optional future work: after launch, call `admin.nodeInfo.enode` and publish it via libp2p so others can discover additional peers dynamically.

---

## 5. Dynamic bootnode discovery (optional enhancement)

If you want to avoid shipping static enode lists:

1. Extend the libp2p bootstrap service to maintain a key such as `/chiral/eth/bootnodes`.
2. Whenever a Geth node starts, it publishes its current enode under that key with a TTL.
3. `start_geth_node` queries the key, collects live enodes, and passes them to `--bootnodes`.

This keeps the network fully decentralized: anyone online becomes a potential bootstrap peer, and the list refreshes automatically as nodes appear/disappear.

---

## 6. Wallet & RPC interaction (current behavior)

The Rust backend already leverages `ethers` to talk to the local Geth RPC (`http://127.0.0.1:8545`). No changes are required there; once the local node is peered, all JSON-RPC calls (`eth_getBalance`, `eth_sendTransaction`, etc.) reflect global state.

Key commands:
- `process_download_payment` → `ethereum::send_transaction` signs and submits via `SignerMiddleware`.
- `get_user_balance` / `get_block_number` / mining metrics all proxy through `ethers`.

Because each node maintains the full chain, as long as peers are connected the RPC results converge across machines.

---

## 7. Monitoring & health checks

Expose simple diagnostics so users know they’re synced:

- `get_eth_peer_count`: call `admin.peers` (via RPC) and return the count.
- `get_eth_block_number`: return `eth_blockNumber`.
- UI indicator: show peers connected + latest block height + chain ID.

From a shell on any node:
```bash
geth attach http://127.0.0.1:8545 --exec 'admin.peers'
geth attach http://127.0.0.1:8545 --exec 'eth.blockNumber'
```

If those match across machines, the ledger is in sync.

---

## 8. Security considerations

- **Consensus**: Ethash PoW relies on cumulative difficulty. As long as honest miners control the majority of hashpower, the longest chain rule protects against attackers.
- **Chain ID**: Hard-coded in `src-tauri/src/ethereum.rs` (currently `98765`). Changing the chain ID requires patching/redeploying the app for everyone.
- **RPC exposure**: Only expose JSON-RPC publicly if you secure it (authentication, firewall). For desktop clients, binding to `127.0.0.1` is safest.
- **Malicious peers**: Geth validates blocks/transactions; invalid data is rejected automatically. Peers can still try to eclipse you, so encourage multiple bootnodes and peers to avoid single points of failure.

---

## 9. Proof-of-Concept without a public node

To validate the flow without paid infrastructure:

1. Choose two machines (LAN or with open ports). Initialize both with the shared `genesis.json`.
2. On machine A, start Geth and grab its enode.
3. On machine B, start Geth with `--bootnodes <machine A enode>`.
4. Once connected, send a test transaction or mine a block on machine A; machine B should see the update via `eth.getTransactionReceipt` / `eth.blockNumber`.
5. Repeat in reverse to confirm bi-directional sync.

Later, replace machine A with a permanent cloud host to avoid manual coordination.

---

## 10. Roll-out checklist (code + ops)

1. **Bootstrap host** — Deploy at least one shared Geth node; document its enode.
2. **Command changes** — Update `start_geth_node` to accept or fetch `bootnodes` and pass them to the spawned process. Ensure discovery is enabled.
3. **Configuration** — Surface bootnode configuration (settings file, CLI flag, or DHT lookup).
4. **Telemetry** — Add optional commands (`get_eth_peer_count`, `get_eth_block_number`) to expose sync status to the UI.
5. **Documentation** — Note firewall/NAT considerations (port 30303) and how to override defaults for power users.
6. **Verification** — Deploy a build, start Geth on two remote machines, confirm `eth.blockNumber` and transactions propagate without manual intervention.

Once these enhancements land, the Chiral app behaves like any other minimalist Ethereum fork: each desktop runs its own node, but shared bootnodes and discovery keep ledgers in sync while the existing `ethers`-based wallet code continues to hit the local RPC endpoint.
