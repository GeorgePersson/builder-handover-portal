# Known Issues

## Documentation Gaps

- The stable front-door docs are `docs/product-brief.md`, `docs/phased-work.md`, and `docs/architecture.md`. Future agents should keep those entrypoints aligned with `HANDOFF.md`, `docs/implementation-phases.md`, `docs/technical-architecture-source-of-truth.md`, and clean-start planning in `docs/greenfield-build-plan.md`.
- README still describes an earlier MVP scope and may lag behind the current document workflow.

## Product/Workflow Gaps

- Cloudflare source pipeline is dry-run; live source enrichment should not be assumed enabled.
- Azure document/context processing is a planned spike, not settled production behaviour.
- Some Supabase migrations may not be applied in every environment; code often preserves compatibility with older schemas.
- Manual browser upload smoke tests may still be needed for flows where Codex browser automation cannot attach files.

## Open Questions

- Whether Azure, LlamaCloud, or local extraction should be the default production document context provider.
- Whether manufacturers need a first-class table or remain product identity fields for now.
- Final UX for multi-unit replication and per-unit variation review.
- Final export format beyond the current client portal.
