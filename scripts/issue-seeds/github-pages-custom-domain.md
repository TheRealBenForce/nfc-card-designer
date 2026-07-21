# Point custom domain at GitHub Pages

**Status:** Deferred

## Problem

Production may still use `nfc-card-designer.therealbenforce.com` on CloudFront while GitHub Pages workflow deploys to the default `*.github.io` URL. We want one canonical host without maintaining duplicate deploy targets long term.

## Proposal

Configure GitHub Pages custom domain (`nfc-card-designer.therealbenforce.com`), validate HTTPS, and update DNS (Route53) to point at GitHub Pages.

## Acceptance criteria

- [ ] GitHub Pages serves the designer on the custom domain with valid HTTPS
- [ ] Relative asset paths work (no broken `/assets/…` on project Pages base path)
- [ ] README documents the active production URL
- [ ] `npm run verify` passes

## Out of scope

- Decommissioning AWS (track separately)
- Changing app behavior

## Notes

- Workflow: `.github/workflows/pages.yml`
- Audit absolute paths in HTML/JS before switching DNS.
