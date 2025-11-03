# Repository Guidelines

## Project Structure & Module Organization
Swift Dictionary is an Electron + React desktop app. `src/main` contains the Electron entry point, window orchestration, dictionary ingestion, and the Gemini API integration. UI code lives in `src/renderer`, with features split across `pages`, shared `components`, Jotai atoms in `store`, and window chrome under `window`. Static assets belong in `assets` and `public`, while packaging and bundler overrides live under `tools/forge` and `tools/webpack`.

## Build, Test, and Development Commands
- `pnpm install` (or `npm install`) to install workspace dependencies aligned with `pnpm-lock.yaml`.
- `pnpm start` boots the development Electron process with hot reload.
- `pnpm run lint` runs ESLint across `src/` for TypeScript and JSX issues; use it before every commit.
- `pnpm run package` produces an unsigned distributable in `out/` for quick smoke testing.
- `pnpm run make` / `pnpm run make:mac` builds signed installers using Electron Forge makers when you are ready to ship.

## Coding Style & Naming Conventions
Use TypeScript for all new modules and favor functional React components. Prettier (configured via `.prettierrc`) enforces 2-space indentation, single quotes, and trailing commas—run your editor integration instead of formatting manually. Honor ESLint rules, especially the unused variable guard; prefix intentional placeholders with `_`. Import shared code through the path aliases defined in `.eslintrc` (for example, `@renderer/constants`).

## Testing Guidelines
No automated test runner ships with the project yet. Exercise critical flows manually: dictionary import, notebook sync, AI lookup, and window controls. If you introduce a testing tool, colocate specs as `*.test.ts(x)` beside the feature and add a matching `pnpm test` script. Document new coverage expectations in your pull request while the suite is evolving.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit pattern (`feat:`, `chore:`, `style:`) visible in `git log`. Keep subjects under 72 characters and describe the impact in the imperative mood. Pull requests should include: a concise summary of the change, screenshots or recordings for UI updates, links to related issues, and a checklist of manual verifications (lint, start-up, packaging when relevant). Request review before merging and wait for at least one approval.

## Environment & Secrets
Copy `.env.example` to `.env` and set `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, and `GEMINI_IMAGE_MODEL` before running AI features. Never commit secrets—use local `.env` files and define any defaults in documentation instead. When contributing Gemini-related changes, guard against missing keys using the `GeminiService` configuration helpers in `src/main/geminiService.ts`.
