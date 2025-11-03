# AI Word Lookup Streaming Stabilisation

## Context
- Streaming lookups currently double-fire. The debounced search path in `src/renderer/components/AISearchComponent.tsx:28` invokes `performLookup` on input change, and the explicit "Search" button at `src/renderer/components/AISearchComponent.tsx:62` does the same. Triggering the button before the 500 ms debounce finishes submits the same word twice, creating parallel IPC streams.
- `aiWordLookupStreamAtom` in `src/renderer/store/index.ts:59` registers fresh `ipcRenderer` listeners for every lookup but only distinguishes requests by `word`. When duplicate requests share the same word, each handler processes the same chunk/complete payload and `generateImageAsync` at `src/renderer/store/index.ts:182` runs repeatedly, yielding multiple image fetches.
- Users observe repeated re-renders on the definition panel and multiple images on the right pane because every duplicate completion overwrites `aiStreamingTextAtom` and `aiSearchResultAtom`. React replays markdown rendering on each `ai-stream-chunk`, so duplicated chunks compound the perceived "multi-refresh" effect.
- Current React reconciliation churn is visible even during a single stream: `aiStreamingTextAtom` emits a brand-new string for every chunk, forcing complete markdown re-renders without diffing. The duplication issue exaggerates this behaviour.

## Goals
- Ensure exactly one active streaming pipeline per user search.
- Guarantee that each lookup produces at most one image request and result.
- Simplify the Jotai wiring so the request lifecycle is explicit and easier to reason about.

## Proposed Changes

### 1. Input & Trigger Handling
- Replace the current debounced lookup with a debounced validation-only path. Keep `localQuery` updates but gate `performLookup` behind explicit submit events (button click or Enter). Cancel any pending debounce when submit fires so we never schedule a stale lookup.
- Optionally convert the search controls into a `<form>` with `onSubmit` to unify keyboard and click handling while preventing default form reload behaviour.

### 2. Stream Lifecycle Management
- Introduce a monotonically increasing `requestId` (e.g., `Date.now()` counter) tracked by a new `aiActiveRequestIdAtom`. `performLookup` stores the active id alongside the word and resets UI atoms (`aiStreamingAtom`, `aiStreamingTextAtom`, `aiImageLoadingAtom`, `aiSearchResultAtom`) for a clean slate.
- Update `ipcMain.handle('ai-lookup-word-stream')` in `src/main/appWindow.ts:332` to accept `{ word, requestId }`. Include this `requestId` in every `ai-stream-chunk`, `ai-stream-complete`, and `ai-stream-error` payload so renderers can ignore stale streams.
- Refactor listener registration in `aiWordLookupStreamAtom` so we remove any previous handlers before attaching new ones and gate updates by matching both `word` and `requestId`. Maintain a single listener set that simply updates atoms when the active id matches.

### 3. Image Generation Gating
- Pass the active `requestId` into `generateImageAsync` and short-circuit if the active id has changed mid-flight. Only call `window.ipcRenderer.invoke('ai-generate-image')` once per stream completion and clear `aiImageLoadingAtom` when that request settles.
- Ensure `aiSearchResultAtom` updates only when the response matches the active request. This prevents late responses from superseded lookups overwriting UI state.

### 4. Retry Flow Alignment
- Repoint `aiRetryLookupAtom` in `src/renderer/store/index.ts:324` to the streaming path so retry honours the same request guards and state resets. Reset `aiActiveRequestIdAtom` before issuing a retry.

## Architecture Note: Where Gemini Calls Should Live
- **Current approach:** The main process (`src/main/appWindow.ts`) owns the Gemini client (`GeminiService`). Renderer ↔ main communication happens via IPC, keeping API keys and rate-limit handling out of the untrusted renderer context.
- **Renderer-direct option:** Calling Gemini from React would eliminate the IPC hops, but it would require bundling credentials or proxying requests. Exposing `GEMINI_API_KEY` in the renderer bundle (or via `process.env`) makes the key extractable through DevTools, which is a security risk for desktop distribution. It also bypasses the existing logging and error normalization in `GeminiService`.
- **Recommendation:** Keep Gemini interactions in the main process. The performance overhead of the IPC bridge is low compared to network latency, and the main process can continue to centralize retries, throttling, and configuration validation. Focus optimisation on reducing duplicate invocations and stream chatter rather than moving the API boundary.

## Verification
- Manual test matrix:
  1. Type a word, press Enter immediately—confirm a single streaming sequence and one image render.
  2. Type, wait for auto validation without submitting—ensure no lookup fires until submit.
  3. Submit two different words back-to-back—old stream stops updating UI once superseded.
  4. Trigger retry after a forced error (e.g., offline)—verify single stream + image when retry succeeds.
- Observe `electron-log` output to ensure request ids line up and only one image invocation occurs per lookup.
