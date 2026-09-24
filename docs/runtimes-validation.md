# Direct Runtimes import validation — 2026-09-12

The framework ownership wrapper and Runtimes re-exports have been removed. Examples and native tests now import `@react-native-runtimes/core` directly. The pinned native patches, automatic setup and production selection are unchanged.

| Check | Result |
| --- | --- |
| Framework and consumer TypeScript | Pass |
| Unit suite | 112 tests, 429 assertions, all passing |
| Generic Go serving direct-import app | 7 native checks passed, including app reload |
| Standalone Release without Metro | 6 native checks passed |
| Worker-only native dependency | Retained by production analysis |
| Unused Runtimes and Nitro | Excluded from production graph and native linked symbols |
| Pruned standalone Release | Launch passed |
| Fresh starter | Declares upstream core directly, exposes no framework Runtimes alias, prunes unused core |
| Existing saved Go | Compatible with the updated SDK; native rebuild unnecessary |

Native checks cover worker identity, isolated heaps, repeated calls, CPU work with a responsive main JS timer, async results, errors, native filesystem access and destruction/recreation after completed calls. Go also confirms that an existing worker is removed on main-app reload. Assertions specific to the removed ownership wrapper were removed with it. Pending-call settlement during destruction is governed by upstream semantics; the usage example awaits work before destroying its runtime.

The SDK archives and manifest were refreshed. The manifest no longer contains `@legendapp/spark-runtimes`; the patched upstream core archive remains included. Machine-specific evidence is saved under the ignored `docs/evidence/runtimes-direct-imports-2026-09-12/` directory. Earlier integration evidence, including custom Debug native validation, remains under `docs/evidence/runtimes-sdk-2026-09-12/`.

Reproduce using the commands in [Runtimes](runtimes.md). Discover upstream packages and our integration policy in [Integrated external libraries](external-libraries.md).
