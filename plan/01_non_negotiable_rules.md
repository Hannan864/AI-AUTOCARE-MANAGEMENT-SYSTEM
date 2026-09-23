# Non-Negotiable Rules

These rules are absolute and must be followed by every developer and automated agent contributing to this project. Violation of these rules constitutes a breach of the project's enterprise standards.

## 1. Absolute Restrictions
1. **Never generate dummy data.** 
2. **Never generate mock data.** 
3. **Never generate fake statistics.** 
4. **Never generate fake requests.** 
5. **Never generate fake users.** 
6. **Never generate fake mechanics.** 
7. **Never generate fake vehicles.** 
8. **Never generate placeholder business logic.**
9. **Never create temporary implementations.**
10. **Never hardcode dashboard values.**
11. **Never hardcode tables.**
12. **Never hardcode cards.**
13. **Never bypass backend logic.**

## 2. Core Operational Mandates
- **Database is the Source of Truth:** The database must always be the definitive source of all state and data.
- **API-Driven Frontend:** All frontend data must come exclusively from APIs.
- **Backend-Driven APIs:** All APIs must execute real backend logic.
- **Database-Driven Backend:** All backend logic must retrieve from and write to actual database records.

## 3. Project Constraints
- **FYP Alignment:** Every feature must match the original FYP proposal.
- **Enterprise Standard:** Every feature must be enterprise-level and production-ready.
- **Continuous Governance:** Every future modification must be documented within the `/plan` directories before, during, or immediately after execution.

## 4. Enterprise Coding Standards
- **Typing & Validation:** Strict typing (TypeScript) and backend payload validation must be enforced.
- **Error Handling:** Graceful, normalized error responses with descriptive (but secure) messages.
- **Modularity:** Separation of concerns between Data representation (HTML/CSS), Application Logic (Controllers/Routes), and Data Access (Repositories).
- **Security:** Do not expose sensitive internal architecture details, paths, or stack traces to the client.
