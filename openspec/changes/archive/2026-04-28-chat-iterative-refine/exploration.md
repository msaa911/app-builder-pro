## Exploration: Chat UI and Message Flow

### Current State

The chat system is a **two-layer architecture**: a pure presentational `ChatPanel` component and a stateful orchestrator in `BuilderPage.handleNewMessage`.

**Message Flow (end-to-end)**:
1. User types in `ChatPanel` textarea → presses Enter or clicks Send
2. `handleSubmit` sanitizes input via `sanitizeInput()` (DOMPurify, strips all HTML tags)
3. Calls `onSendMessage(sanitizedContent)` → which is `BuilderPage.handleNewMessage`
4. `handleNewMessage` creates a `ChatMessage` with role `'user'`, appends to `messages[]` state
5. **Routing logic (ITR-002)**: `const isRefine = currentFiles.length > 0`
   - **First message** (no files yet) → calls `generate(prompt, apiKey, modelId)` → `AIOrchestrator.generateApp()`
   - **Follow-up messages** (files exist) → saves pre-refine snapshot → calls `refine(currentFiles, prompt, apiKey, modelId)` → `AIOrchestrator.refineApp()`
6. AI response is parsed into `{ message, files, warnings }` → assistant `ChatMessage` is appended with optional diff summary
7. Files are applied: merge (for refine) or set (for generate), then WebContainer is updated

**Conversation History**: The `messages[]` array is **UI-only state** — it is NOT sent to the AI. Each `refineApp()` call receives only:
- Serialized current files (max 10 files, 5000 chars each, 50K total)
- The user's current request (single message only)

**Key Insight**: There is NO multi-turn conversation context sent to the AI. Previous messages like "change the color to blue" are invisible to subsequent requests like "make it darker".

### Affected Areas

- `src/components/chat/ChatPanel.tsx` — Pure presentational chat UI (137 lines)
- `src/pages/BuilderPage.tsx` — `handleNewMessage` (lines 120-268) routing logic, `handleNewChat` (lines 277-282) reset logic
- `src/hooks/useAIBuilder.ts` — Exposes `generate()` and `refine()` (63 lines)
- `src/services/ai/AIOrchestrator.ts` — `generateApp()` (lines 48-89) and `refineApp()` (lines 92-134)
- `src/services/ai/prompts.ts` — `SYSTEM_PROMPT` and `REFINE_PROMPT` templates
- `src/types/index.ts` — `ChatMessage` interface (id, role, content, files?, timestamp)
- `src/utils/mergeFiles.ts` — File merge with collision tracking (AI wins)
- `src/utils/fileDiff.ts` — Diff computation + summary for chat display
- `src/utils/sanitize.ts` — DOMPurify input sanitization (SEC-03)

### Approaches

1. **Status Quo — Stateful routing, no conversation context**
   - Pros: Already implemented and tested (ITR-002 through ITR-009), simple
   - Cons: AI loses context between turns ("make it darker" after "change to blue" fails), no way to reference previous decisions
   - Effort: N/A (current state)

2. **Add conversation history to refineApp calls**
   - Pros: AI can understand multi-turn context, better refinement quality
   - Cons: Token cost increases, need to cap history length, prompt size management
   - Effort: Medium

3. **Gemini ChatSession (multi-turn API)**
   - Pros: Native conversation support, automatic history management by Gemini SDK
   - Cons: Tightly couples to Gemini SDK chat model, harder to swap providers, session management complexity
   - Effort: Medium-High

### Recommendation

**Approach 2** is the pragmatic path — pass a summary of recent conversation turns (last N messages) into `refineApp` alongside the current files + request. This avoids provider lock-in while giving the AI enough context to understand multi-turn requests.

Key considerations:
- Cap conversation context to last 5-10 messages to manage token usage
- Only include user messages + assistant summaries (not full file contents) in context
- Update `REFINE_PROMPT` to include a `Conversation History` section
- Keep the file serialization as-is (it's already well-bounded)

### Risks

- **Token budget**: Adding conversation history pushes refineApp closer to model limits. The current file serialization already uses up to 50K chars. Conversation history must be aggressively truncated.
- **Prompt injection via history**: Previous assistant messages stored in `messages[]` are rendered via ReactMarkdown with rehype-sanitize, but when re-sent to AI they could influence model behavior. Mitigation: only send user messages + brief assistant summaries.
- **State consistency**: If `messages[]` grows unbounded, memory usage could become an issue. Consider a max messages cap or pruning strategy.
- **Backward compatibility**: Existing tests (chat-refine.e2e.test.tsx, BuilderPage.refine.test.tsx) mock the AI orchestrator directly and may need updates if refineApp's signature changes.

### Ready for Proposal

Yes — the current system has a clear gap (no conversation context in refine calls) and a straightforward path to address it. The orchestrator should propose adding bounded conversation history to the refineApp flow.
