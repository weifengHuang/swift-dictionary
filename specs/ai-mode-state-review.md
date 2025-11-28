# AI Mode State Management Review

## Current Pain Points
- **Atom fan-out is high.** The AI slice defines eleven top-level atoms (`aiSearchLoadingAtom`, `aiImageLoadingAtom`, `aiStreamingAtom`, `aiStreamingTextAtom`, `aiSearchErrorAtom`, `aiImageErrorAtom`, etc.) in a single module (`src/renderer/store/index.ts:10-36`). Every lookup sets or resets each atom manually, which makes the lifecycle hard to reason about and easy to desynchronise.
- **Lifecycle logic is scattered.** `aiWordLookupStreamAtom` drives IPC wiring, status toggles, retries, and image generation (`src/renderer/store/index.ts:143-357`). Because updates are spread across chained `set` calls, it is difficult to verify that all branches leave the store in a valid state (e.g. an early return might clear `aiImageLoadingAtom` but not `aiSearchLoadingAtom`).
- **Renderer components depend on raw atoms.** `AISearchComponent` pulls twelve atoms directly (`src/renderer/components/AISearchComponent.tsx:5-37`), so UI code needs deep knowledge of how the store works. This tight coupling makes refactors risky and forces the component to orchestrate actions like retrying or cancelling streams.
- **Cross-feature state shares a file.** Dictionary atoms (`searchResultsAtom`, `selectedWordDefinitionAtom`) live beside AI atoms in `src/renderer/store/index.ts`, which mixes concerns and encourages further growth of the monolithic store file.

## Recommended Direction

### 1. Default to a local controller + Provider
- Encapsulate the entire lookup lifecycle in `useAiLookupController` (internal `useReducer`, `query`, `status`, `result`, `errors`, `activeRequestId`).
- Wrap AI-facing UIs with `<AiLookupProvider>` that exposes `useAiLookup() { state, actions }`. `AISearchComponent` consumes the hook; `WordDefinitionDisplay` 和 `AIImageDisplay` 继续通过 props 获取数据。
- 这样在当前“单页面”场景下无需全局状态，结构简洁；未来做划词弹窗时，只需在弹窗根部包同一个 Provider，即可复用逻辑。

### 2. Keep a reducer-friendly path for future globalisation
- 如果后续确实要跨窗口共享同一状态（例如主界面和划词小窗同步历史），可把 Provider 内部实现从 `useReducer` 换成 `atomWithReducer` 或其它 store 实现，对消费者零侵入。
- 无论使用 React reducer 还是 Jotai reducer atom，都要让 `AiLookupState` 包含 `query`, `status`, `result`, `stream`, `image`, `error`, `retryCount`, `activeRequestId` 等字段，并通过限定的 action 更新，保持状态变更可追踪。

### 3. Derive UI selectors instead of duplicating flags
- 使用 memoised selector（在 Provider 内）派生 `isLoading`, `isStreaming`, `canRetry` 等视图状态，避免重新引入十几个布尔 atom。
- 暴露 `state`（或分片 selector）给 UI，`AISearchComponent` 不再需要知道内部结构，只读所需字段即可。

### 4. Encapsulate streaming side effects
- 将 IPC 监听与请求发送封到 controller/service 内部：`startLookup` 注册一次 listener，按 `requestId` 分发 `chunk/complete/error` action。
- 图片生成同样只在 `complete` 后触发一次；若 `activeRequestId` 变化则提前终止，保证 late response 不覆盖当前状态。
- Retry 逻辑只 dispatch `restart`，其余清理由 reducer 负责。

### 5. Isolate feature stores and export hooks
- 把字典、AI 模式等逻辑拆进 `store/dictionary.ts`, `store/aiLookup.ts`；`store/index.ts` 只作为 re-export 网关。
- 导出 `useAiLookup`, `AiLookupProvider` 等 API，让界面层完全通过 hooks/props 交互。

## Suggested Migration Steps
1. 创建 `src/renderer/store/aiLookup.ts`，导出 `<AiLookupProvider>`、`useAiLookup()`；内部先实现 `useReducer` 版本的 controller 与 selectors。
2. 调整 `AISearchComponent` 改从 `useAiLookup()` 读取状态/动作，删除 `useAtom` 依赖；`WordDefinitionDisplay` / `AIImageDisplay` 仍走 props。
3. 把 IPC/流式逻辑迁移进 controller/service，根据 `requestId` dispatch `chunk`、`complete`、`error`、`imageResolved` 等 action。
4. 验证浮窗/弹窗等新容器可以通过包裹 Provider 复用同一组件组合；若未来需要跨窗口共享，再在 Provider 内切换到 Jotai reducer atom。
5. 清理旧 atom，整理 `store/index.ts` 只做 re-export，避免再生 monolithic store。

## Additional Considerations
- 目前查询词只在 AI 模式管控，放进 reducer state 即可；若主界面/浮窗要共享搜索历史，再抽出共享 store。
- `aiModeActiveAtom` 与路由状态重复，可通过 React Router 推断，减少冗余。
- 设计划词弹窗时，直接复用 `<AiLookupProvider>` + 现有显示组件，IPC 服务层负责区分窗口；无需暴露 API key 给 renderer。
- 重构过程中继续执行手动冒烟（流式响应、错误重试、图片生成）以确认 reducer/action 序列正确。
