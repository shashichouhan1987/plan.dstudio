# AGENTS.md

## Project overview

This repository is a Next.js marketing site derived from a Webflow export.

- App entry and page routes live under `pages/`
- The raw Webflow export lives under `website/`
- Imported/generated assets are managed by `scripts/import-webflow.mjs`
- Shared styling is centralized in `styles/globals.css`
- Page-level wrappers and imported Webflow logic live in `src/components/WebflowPage.jsx`

## Working conventions

- Prefer minimal, local fixes that match the existing Next.js structure.
- Keep page edits in `pages/` and reusable behavior in `src/`.
- Do not treat `website/` as a source of truth for hand-edited app code; it is a Webflow export.
- If a change is intended to reflect a new Webflow export, refresh it via `npm run import:webflow` instead of hand-editing generated output.
- Preserve current route names and file conventions unless the task explicitly asks to rename or reorganize pages.

## Commands

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Production build check: `npm run build`
- Refresh imported/exported Webflow content: `npm run import:webflow`

## Verification

- For UI or page work, validate with a build when feasible: `npm run build`.
- If the task is purely content or route-level, prefer the smallest direct validation that checks the affected behavior.
- Do not claim a fix is complete without confirming the relevant command succeeds.

## Notes for AI agents

- The project is intentionally simple: there are no broad test suites or complex architecture patterns to learn.
- The main risk is editing generated Webflow artifacts or missing the import pipeline.
- For page work, read the relevant page and the Webflow wrapper before patching.
- Keep edits consistent with the current repo style and avoid rebuilding unnecessary abstractions.

## Useful references

- [README.md](README.md)
- [package.json](package.json)
- [scripts/import-webflow.mjs](scripts/import-webflow.mjs)
- [src/components/WebflowPage.jsx](src/components/WebflowPage.jsx)
- [styles/globals.css](styles/globals.css)
