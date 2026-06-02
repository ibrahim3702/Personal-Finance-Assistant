# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
Here is a custom Claude Code skill document tailored specifically for building your Personal Finance Assistant. It focuses on the architectural, AI-routing, and UX patterns needed to solve the specific constraints of speed, cost, and data scale.

---

# Full-Stack AI Architecture: Personal Finance Assistant

Create a highly scalable, economically viable, and instantly responsive personal finance AI. This skill applies a four-vector approach to AI product design: Intent Routing, Hybrid Data Storage, Perception of Speed (UX), and Persistent Memory.

## Core Principles

**Avoid monolithic LLM calls**: Reject the default pattern of dumping all user data into a massive prompt. Instead, use intelligent routing, tool-calling, and right-sized models to balance speed, cost, and accuracy.

**Trust through performance**: Financial apps require absolute exactness. Use deterministic code (SQL/math) for exact numbers and LLMs strictly for reasoning, extraction, and natural language generation.

## 1. Intent Routing & Cost Strategy

### Strategy

* **Categorize before executing**: Not every query needs GPT-4o or Claude 3.5 Sonnet.
* **Use small models for routing**: Use fast, cheap models (e.g., Haiku, GPT-4o-mini) to classify the user's intent.
* **Route to the right engine**:
* *Math/Aggregation* -> Text-to-SQL -> Database.
* *Receipt/Image* -> Vision Model -> JSON Extraction -> Database.
* *Advice/Comparison* -> Advanced LLM + RAG.



### Implementation Pattern (The Orchestrator)

```typescript
// Example: Intelligent Routing based on intent
async function handleUserQuery(prompt: string, userId: string) {
  // 1. CHEAP/FAST CALL: Classify intent
  const intent = await classifyIntent(prompt); 

  switch (intent.type) {
    case 'EXACT_LOOKUP':
      // "How much did I spend on food?"
      // Action: Use LLM to write SQL, execute it deterministically. Fast & cheap.
      return await executeTextToSQL(prompt, userId);

    case 'RECEIPT_UPLOAD':
      // Action: Route to Vision model for strict JSON extraction
      return await processReceiptImage(intent.imageUrl);

    case 'DEEP_ANALYSIS':
      // "Am I spending more than usual?"
      // Action: Fetch historical summaries (not raw rows!), send to powerful model
      const monthlySummaries = await getAggregatedHistory(userId);
      return await generateFinancialAdvice(prompt, monthlySummaries);
      
    case 'WEB_SEARCH':
      // "What is this STRIPE*193 charge?"
      return await searchUnfamiliarMerchant(intent.entities[0]);
  }
}

```

## 2. Hybrid Data Architecture - Handling Scale

### Strategy

* **Never feed raw transaction logs to an LLM**: If a user has 5 years of data, token limits and costs will break.
* **Relational for Math, Vector for Search**: Store exact transactions in Postgres. Store summaries and contextual embeddings in a Vector DB.
* **Pre-compute summaries**: Run cron jobs to summarize months/weeks so the LLM doesn't have to read 10,000 rows to answer "How was my March?"

### Database Pattern (Prisma/Postgres Example)

```prisma
// 1. Relational Table for Exact Math (Never loses pennies)
model Transaction {
  id          String   @id @default(uuid())
  userId      String
  amount      Decimal  @db.Decimal(10, 2)
  date        DateTime
  merchant    String
  category    String
  isRecurring Boolean  @default(false)
}

// 2. Vector Table for Semantic Search (Finding hidden patterns)
model TransactionEmbedding {
  id            String   @id
  transactionId String
  embedding     Unsupported("vector(1536)")
  // Used for: "Find purchases like that coffee shop I went to"
}

// 3. User Memory Store (The Context Vector)
model UserPreference {
  id      String @id
  userId  String
  rule    String // e.g., "Exclude rent from food budget"
  applied Boolean
}

```

## 3. Frontend & UX - The Perception of Speed

### Strategy

* **Stream everything**: The user must see text within 500ms, even if the database is still calculating.
* **Use Generative UI (Server-Driven UI)**: Return interactive React components (charts, budget sliders) instead of just plain text.
* **Optimistic execution**: For actions like setting a budget, update the UI instantly before the DB confirms.

### Implementation Pattern (Vercel AI SDK / React)

```tsx
// Using Generative UI to return a Chart component, not just text
import { useChat } from 'ai/react';
import { SkeletonChart, SpendingChart } from '@/components/charts';

export function FinanceAssistant() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div className="chat-container">
      {messages.map(m => (
        <div key={m.id} className={`message ${m.role}`}>
          {/* If the LLM returns a tool invocation for a chart, render it */}
          {m.toolInvocations?.map(tool => {
            if (tool.toolName === 'showSpendingChart') {
              return tool.state === 'result' ? (
                <SpendingChart data={tool.result} />
              ) : (
                <SkeletonChart animate="pulse" /> // Show loading state instantly
              );
            }
          })}
          <p>{m.content}</p>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Ask about your money..." />
      </form>
    </div>
  );
}

```

## 4. Context & Memory Handling

### Strategy

* **Isolate rules from history**: Extract user preferences ("I get paid on the 1st") from the chat stream and save them to a dedicated database table.
* **System Prompt Injection**: Inject these saved rules into the system prompt of every future query so the assistant "remembers" them without needing to read the entire chat history.

### Implementation Pattern

```typescript
// System Prompt Builder
async function buildSystemPrompt(userId: string) {
  // Fetch explicitly saved user rules (cheap, fast DB lookup)
  const userRules = await db.userPreferences.findMany({ where: { userId } });
  const formattedRules = userRules.map(r => `- ${r.rule}`).join('\n');

  return `
    You are a highly capable personal finance assistant.
    Always prioritize exact numbers over estimations.
    
    CRITICAL USER CONTEXT:
    ${formattedRules}
    
    If the user asks to ignore a category, apply it strictly to your SQL/Tool calls.
  `;
}

```

## Workflow: Building a Feature

When adding a new capability to the assistant, follow this sequence:

### 1. Determine the "Engine" Needed

Ask: Does this require math, vision, or reasoning?

* *Identify Subscriptions* -> Batch background job (SQL `GROUP BY` merchant, frequency analysis) -> LLM just formats the output.
* *Read Receipt* -> Vision LLM -> structured JSON output -> DB Insert.

### 2. Design the Tool (Function Calling)

Never let the LLM guess the schema. Provide strict Zod schemas for the LLM to call your internal APIs.

```typescript
const getSpendingTool = {
  name: 'get_spending',
  description: 'Calculates total spending for a specific timeframe and category',
  parameters: z.object({
    startDate: z.string().describe('ISO date string'),
    endDate: z.string().describe('ISO date string'),
    category: z.string().optional(),
    excludeCategories: z.array(z.string()).optional() // Allows applying user context!
  })
}

```

### 3. Test Against Constraints Checklist

❌ **Avoid**:

* Pulling 5,000 transactions into the prompt to answer "What is my biggest expense?" (Fails Cost & Scalability).
* Waiting 10 seconds for a complex reasoning task with a blank screen (Fails Speed).
* Using an LLM to calculate `SUM(amount)` (Fails Trust/Accuracy — LLMs are bad at math).

✅ **Aim for**:

* LLM translates natural language to strict tool calls/SQL.
* Background jobs pre-calculating monthly summaries.
* Vercel AI SDK (or similar) streaming text while background tools fetch data.
* Structured data extraction for all receipt parsing.