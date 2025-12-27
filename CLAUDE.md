# Claude Code Instructions

## Critical Rules (Never Break These)

### 1. Git Workflow (Manual Push/Pull)
- **Before starting any session:** Tell me to run `git pull origin main`
- Local git commands (`git add`, `git commit`, `git status`, `git log`) are fine
- **After completing a feature:** Run `git add . && git commit -m "description"`, then tell me to push manually
- Do NOT use GitHub MCP for push operations - I will push manually
- Do NOT mark a task complete until I confirm the push succeeded

### 2. Single Branch Only
- Work on `main` branch only
- **NEVER** create new branches unless I explicitly ask for one
- If you find yourself on a different branch, switch to main before doing anything

### 3. Before Editing Any File
- **ALWAYS** read the current file content first using `cat` or file read
- State what you found in the file before making changes
- If the file seems different than expected, re-read it
- Make surgical edits to specific sections, NOT whole file replacements
- If you need to change multiple parts of a file, do them one at a time

### 4. Subagent Usage (Mandatory)
**Use a subagent for ALL of these operations:**
- Any MCP tool call (Notion, n8n, GitHub, Vercel)
- Reading files over 100 lines
- Listing directories
- Any operation you expect to return more than 50 lines of output

**Subagent instructions:**
- For READ operations: Return a summary (key fields, names, IDs, counts)
- For WRITE operations: Return confirmation of what was written
- Never return raw JSON dumps to main context

### 5. Loop Prevention
- Before attempting any operation, state what you're about to do
- If an operation fails, explain why and ask me what to do. Do NOT retry automatically
- If you've tried the same approach twice, STOP completely and ask for guidance
- If you feel like you've done this before in this session, you probably have. Stop and ask.

### 6. Context Awareness
- If you notice compaction happening, tell me immediately
- Before any multi-step task, estimate if you have enough context to complete it
- If context is getting low, stop and suggest we start a new session with a summary

### 7. Verify Before Creating
- Before creating any Vercel project, check if one already exists for this repo
- Before any write operation to Notion, confirm the target database/page with me
- Before creating files, check if the path already exists

## Planning Requirements

### Before Any Task:
1. State what you're about to do in 1-2 sentences
2. If multi-step, list the steps first
3. For tasks over 5 tool calls, ask for confirmation before starting

### After Any Task:
1. Confirm what was done
2. Show me the specific changes made (not the whole file)
3. If you see potential improvements to the code, mention them (don't implement without asking)
4. Remind me to push: "Ready to push. Run: git push origin main"

## MCP Server Rules

### GitHub MCP
- Use for: reading repos, reading files, listing branches, checking commit history
- Do NOT use for pushing - I push manually
- If auth fails, STOP. Tell me to fix it manually.

### Notion MCP
- Use for: reading pages, reading databases, simple updates
- For complex database operations with many entries, process in batches of 10
- Always use subagent to read first, return summary, then write

### n8n MCP
- Use for: listing workflows, reading workflow details
- For workflow UPDATES: Do not attempt via MCP. Tell me what to change and I'll do it in the n8n UI.
- n8n responses are massive. Always use subagent.

### Vercel MCP
- Use for: deployment status, project listing
- Before creating a project, list existing projects to check if it exists
- One repo = one project. Never create duplicates.

## Code Quality

- After completing a feature or fix, briefly review the code
- If you see obvious improvements (cleaner logic, better naming, potential bugs), mention them
- Don't implement improvements without asking first
- When reading code to understand it, summarize your understanding instead of quoting large blocks

## Communication Style

- Be direct. No fluff.
- If something fails, give me the ONE most likely fix, not five options.
- If unsure, say so and ask.
- Don't apologize for limitations. State them and move on.

## What NOT To Do

- Do not go on multi-step rampages without checking in
- Do not retry failed operations more than once
- Do not dump full JSON/XML into explanations
- Do not attempt to fix credential or auth issues
- Do not create branches
- Do not replace entire files when only a section needs changing
- Do not continue past errors hoping they'll resolve
- Do not skip reading a file before editing it
