## Tokio timing
- **Pattern:** `src-tauri/tests/nat_traversal_e2e_test.rs` relies on multi-second `sleep`, causing slow/intermittent runs.
- **Fix:** Introduce an async polling helper with a timeout.
```diff
--- a/src-tauri/tests/nat_traversal_e2e_test.rs
+++ b/src-tauri/tests/nat_traversal_e2e_test.rs
@@
-    sleep(Duration::from_secs(2)).await;
+    wait_for(|| swarm_a.connected_peers() > 0, Duration::from_secs(2)).await?;
@@
+async fn wait_for<F>(mut check: F, timeout: Duration) -> anyhow::Result<()>
+where
+    F: FnMut() -> bool,
+{
+    let deadline = Instant::now() + timeout;
+    while Instant::now() < deadline {
+        if check() {
+            return Ok(());
+        }
+        tokio::time::sleep(Duration::from_millis(100)).await;
+    }
+    anyhow::bail!("condition not met within {:?}", timeout);
+}
```

## Randomness seeding
- **Pattern:** Vitest suites (e.g. `tests/multi-source-download.test.ts`) depend on `Math.random`, leading to nondeterministic assertions.
- **Fix:** Stub `Math.random` in a shared setup file.
```diff
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@
   test: {
     include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
     environment: "node",
     globals: true,
+    setupFiles: ["tests/setup.ts"],
   },
```
```diff
++ b/tests/setup.ts
@@
import { beforeEach, afterEach, vi } from "vitest";

let counter = 0;

beforeEach(() => {
  counter = 0;
  vi.spyOn(Math, "random").mockImplementation(() => ((++counter % 997) / 997));
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

## Port contention
- **Pattern:** `relay/tests/relay_integration_test.rs` binds fixed ports; parallel runs fail when ports are occupied.
- **Fix:** Reserve ephemeral loopback ports per test.
```diff
--- a/relay/tests/relay_integration_test.rs
+++ b/relay/tests/relay_integration_test.rs
@@
-    let relay_port = 4001;
+    let relay_port = reserve_loopback_port().expect("allocate port");
@@
-    Swarm::listen_on(&mut swarm, format!("/ip4/0.0.0.0/tcp/{relay_port}").parse().unwrap()).unwrap();
+    Swarm::listen_on(&mut swarm, format!("/ip4/0.0.0.0/tcp/{relay_port}").parse().unwrap()).unwrap();
@@
+fn reserve_loopback_port() -> std::io::Result<u16> {
+    let socket = std::net::TcpListener::bind("127.0.0.1:0")?;
+    let port = socket.local_addr()?.port();
+    drop(socket);
+    Ok(port)
+}
```

