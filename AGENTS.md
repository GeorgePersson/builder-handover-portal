<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Operating Rules

- Read `HANDOFF.md` first, then the relevant docs in `docs/` before making changes.
- Use `docs/product-brief.md`, `docs/phased-work.md`, and `docs/architecture.md` as the stable project-memory entrypoints.
- For clean-start or rebuild planning, also read `docs/greenfield-build-plan.md`; otherwise treat it as a deeper planning reference linked from `HANDOFF.md`.
- Keep changes scoped to the requested phase or bug; do not invent major product behaviour.
- Keep the builder workflow spec-upload-first and builder-reviewed before anything becomes client-facing.
- Update docs when product behaviour, schema, architecture, or workflow phase changes.
- Add or update tests where practical.
- Run available checks before finishing, usually `npm.cmd run lint` and `npm.cmd run build` for app changes.
- Update `docs/agent-handoff-log.md` after meaningful work.
