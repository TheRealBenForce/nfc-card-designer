# Decommission AWS S3+CloudFront static hosting

**Status:** Deferred (follow-up to GitHub raw artwork migration)

## Problem

The app now deploys to both GitHub Pages and AWS S3+CloudFront. Running two static-site hosts adds maintainer overhead (credentials, CloudFront invalidation, duplicate CI) if GitHub Pages becomes the sole production target.

## Proposal

Remove AWS static-site deploy workflow and infrastructure docs once GitHub Pages serves production traffic with the custom domain.

## Acceptance criteria

- [ ] Custom domain points at GitHub Pages (or decision documented to keep AWS)
- [ ] `.github/workflows/deploy.yml` and AWS deploy secrets removed or archived
- [ ] `infrastructure/` and README deploy sections updated
- [ ] `npm run verify` passes

## Out of scope

- Changing artwork URLs or game catalog pipeline
- Removing libretro-thumbnails dependency

## Notes

- See `docs/decisions/0001-github-raw-artwork.md` — S3 was kept as static **site** hosting only; artwork is always from GitHub raw.
- Do not start until GitHub Pages is verified in production.
