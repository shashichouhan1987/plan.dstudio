# Dstudio Website

This is a Next.js version of the Webflow export.

## Local development

```bash
npm install
npm run dev
```

## Webflow import

The raw Webflow export lives in `website/` and zip files may sit in the project root while working locally. Both are ignored by Git.

To refresh the converted pages and local assets from a new Webflow export:

```bash
npm run import:webflow
```
