# Job-Finder Workspace Guardrails & Rules

## 1. Streamlit Session Isolation (CRITICAL)
- **NO MODULE-LEVEL SESSION STATE**: Never instantiate auth controllers, cookie handlers, or session caches at the module level (e.g. `controller = CookieController()`). Streamlit runs all sessions in a shared Python process memory. Module-level variables leak user data, credentials, and JWT tokens across concurrent user sessions.
- **STRICT `st.session_state`**: All user authentication, credentials, and profile identifiers MUST live strictly inside `st.session_state["user"]` or per-connection scope.
- **SUPABASE RLS**: Whenever making queries or mutations on tables protected by Row Level Security (RLS), always pass the user's JWT access token: `client.postgrest.auth(access_token)`.

## 2. Windows PowerShell Execution
- In PowerShell, NEVER propose or run compound commands with `&&`. Always use semicolons `;` or separate sequential commands.
