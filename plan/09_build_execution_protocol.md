# Build Execution Protocol

## Purpose
This protocol controls all future development. Every AI agent or developer MUST adhere to these sequential steps prior to changing code.

## The Protocol Checklist

1. **Read All Plan Files:** Scan all memory and architectural rules within `/plan`.
2. **Compare Requirements vs FYP:** Ensure the requested work aligns natively with the Master Project Vision (`00_master_project_vision.md`).
3. **Validate Architecture:** Check against `02_system_architecture.md` to guarantee the implementation style matches.
4. **Validate Database Integration:** Confirm that the schemas defined in `03_database_master_blueprint.md` possess the capacity to store the new feature without bypassing the database.
5. **Role Specificity Check:** Review `04`, `05`, `06` role specifications to confirm the correct entity should process the workflow.
6. **Apply UI Standards:** Ensure the UI components conform to the enterprise SaaS models defined in `07_ui_ux_design_system.md`.
7. **Evaluate Current Implementation:** Cross-check the existing physical codebase to define precisely where the changes must occur without destroying active features.
8. **Detect Constraints & Conflicts:** Explicitly recognize if the requested feature attempts to use mock data or violate a rule in `01_non_negotiable_rules.md`. Abort building if it does.
9. **Execution (Build):** Build strictly according to the findings. Do not deviate.
10. **UPDATE PLANNING FILES:** Immediately upon successful verification of the codebase, append the actions to `10_project_memory_and_progress_log.md`.
