# Contributing to OpenKani

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Turso CLI](https://docs.turso.tech/cli/installation)

## Setup

```bash
git clone <repo-url>
cd open_wani
bun install
cp .env.example .env
```

Edit `.env` with your Turso credentials (see README for how to obtain each).

Push schemas to both databases:

```bash
bun run db:push:template   # template DB schema
bun run db:push:registry   # registry DB schema
```

## Development

```bash
bun run dev        # starts at http://localhost:3000 with hot reload
bun run typecheck  # type-check without emitting
```

## Pre-commit hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs automatically on `git commit`:
- `bun run format` — Biome format + lint
- `bun run typecheck` — TypeScript type check

Hooks install on first `bun install`. No manual setup needed.

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Keep PRs small and focused on a single concern
3. Ensure `bun run typecheck` passes before pushing
4. Reference any related issues in the PR description

## License

By contributing you agree your work will be licensed under the [MIT License](LICENSE).
