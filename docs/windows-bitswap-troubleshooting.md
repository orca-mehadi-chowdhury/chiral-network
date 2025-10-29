# Windows↔Windows Bitswap Transfers

This note captures the current fix for cross‑Windows Bitswap downloads and outlines follow‑up checks if issues keep showing up.

## What Changed
- **Symptom**: Downloads stalled on Windows because the temporary file (`*.tmp`) could not be renamed to its final name. The OS reported that the file was still in use.
- **Diagnosed Cause**: The Bitswap downloader holds a `memmap2::MmapMut` open for the duration of the transfer. On Windows the rename fails while the map is alive, so even completed transfers errored out.
- **Fix**: Wrap the memory map in an `Option` and explicitly `flush()` and `take()` it before renaming. All read/write helpers now guard against the map being dropped. (See `src-tauri/src/dht.rs` around the `ActiveDownload` struct.)

## If Transfers Still Fail
1. **Confirm the log**  
   Check for `Failed to finalize file` or `Access is denied` messages in the Tauri log. If they still appear, verify the new binaries are in use.
2. **Look for other file locks**  
   Anti‑virus scanners, backup tools, or cloud sync clients can reopen the temp file. Temporarily disable them or add the storage directory to an exclusion list.
3. **Validate the download path**  
   Ensure the chosen folder isn’t on a network share with different permissions or a path longer than Windows’ legacy 260‑character limit.
4. **Inspect Bitswap connectivity**  
   - Run with `RUST_LOG=chiral_network::dht=debug` to confirm we connect to at least one seeder before chunks start flowing.  
   - Use `dhtService.getSeedersForFile` (frontend) or monitor `Connected to X/Y seeders` logs (backend).
5. **Check chunk bookkeeping**  
   Watch for repeated `Received chunk` indices. If the downloader requests the same chunk forever, investigate:  
   - Seeder running older code that emits unpadded chunks  
   - Chunk size mismatch (defaults to 256 KiB)  
   - Failed Merkle root verification
6. **Fallback strategy**  
   If memmap issues persist, consider swapping the Windows path to buffered file writes (`WriteFile` per chunk) instead of `mmap`. The current code can be feature‑gated to only use `mmap` on Unix.
7. **Collect environment details**  
   Note Windows version, filesystem (NTFS/ReFS), whether Controlled Folder Access is enabled, and whether the storage location is under OneDrive/Desktop sync.

## Quick Validation Checklist
- Upload a test file on node A (Windows).  
- Download the same file on node B (Windows) via Bitswap.  
- Confirm the `.tmp` file disappears and the final file is readable.  
- Tail logs for `Successfully finalized file` and verify the downloader emits `file_content`.

Keep this doc updated as we learn more about Windows edge cases. Feel free to add log snippets or repro steps that help future debugging.
