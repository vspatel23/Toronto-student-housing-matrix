# Toronto Student Housing Matrix Frontend

This directory contains the React/Vite browser application for Toronto Student Housing Matrix.

Start with the repository's main documentation:

- [Project README](../README.md)
- [Technical Documentation](../docs/TECHNICAL_DOCUMENTATION.md)
- [Project Closure Artifacts](../docs/PROJECT_CLOSURE.md)

## Local development

Node.js 24.x is the version used by CI.

```bash
npm install
cp .env.example .env
npm run dev
```

`VITE_API_URL` must point to the Express backend. `VITE_MAPTILER_KEY` is optional; maps fall back to OpenStreetMap when it is blank.

## Verification

```bash
npm test
npm run lint
npm run build
```

For complete backend setup, MongoDB seeding, environment variables, public deployment, and demo-account instructions, use the root [README](../README.md#local-installation).
