# Build Rules

This file governs how new features and changes are implemented to prevent destructive rebuilds or unnecessary overhauls of the existing application.

## Absolute Directives

1. **Never recreate existing modules.** If a module exists, improve or expand it instead of building a new one from scratch.
2. **Never rewrite working modules.** If it works and meets requirements, leave it alone. Do not refactor purely for aesthetics.
3. **Fix before rebuild.** Always prioritize fixing a bug in existing code over tossing the code and rewriting it.
4. **Extend before replace.** When adding functionality, extend the existing architecture.
5. **Preserve database schema.** Do not randomly change tables or drop columns. Schema modifications must be deliberate, documented, and backward compatible.
6. **Preserve APIs unless broken.** Do not change API contracts without cause. Existing frontend components rely on them.
7. **Preserve UI unless broken.** Maintain the existing UI structure. Focus on functionality over redesigns.
8. **Update existing code instead of generating new architecture.** Work within the current file structures, routing patterns, and data access layers.
9. **Analyze current implementation before modifying anything.** You MUST read and understand the existing surrounding code before inserting or modifying lines.
10. **If a feature exists partially, complete it instead of rebuilding it.** Continue from where the last developer or session left off.
