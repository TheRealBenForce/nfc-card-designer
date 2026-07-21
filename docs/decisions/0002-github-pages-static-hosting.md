# 0002 — GitHub Pages as sole static-site host

**Status:** Accepted  
**Date:** 2026-07-21

## Context

The app previously deployed to both GitHub Pages and AWS S3+CloudFront on every push to `main`. That duplicated CI work, required AWS credentials and CloudFront invalidation, and added maintainer overhead.

Game artwork always loads from libretro-thumbnails on GitHub (`raw.githubusercontent.com`) — see [0001-github-raw-artwork.md](./0001-github-raw-artwork.md). AWS was static **site** hosting only.

## Decision

1. **Production deploy** uses GitHub Pages via `.github/workflows/pages.yml` (GitHub Actions source).
2. **Remove** the AWS deploy workflow (`.github/workflows/deploy.yml`), `scripts/deploy.mjs`, and active `infrastructure/` docs from the repo root.
3. **Archive** the former CloudFormation template under `docs/archive/aws-static-hosting/` for stack teardown reference.
4. **Custom domain** (`nfc-card-designer.therealbenforce.com`) is configured separately in GitHub Pages settings and Route53; until DNS points at Pages, the canonical URL is `https://therealbenforce.github.io/nfc-card-designer/`.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep dual deploy (GitHub Pages + AWS) | Rejected — duplicate CI and secrets for no user-facing benefit |
| AWS only | Rejected — GitHub Pages is simpler and already working |

## Consequences

- Delete repository secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `CLOUDFRONT_DISTRIBUTION_ID` after merge.
- Optionally delete the `nfc-card-designer` CloudFormation stack in AWS (see archived README).
- Deploy workflows still run `npm run build-game-catalog` before publishing `src/`.
- Extensionless routes (`/supplies`, `/recognition`) rely on GitHub Pages serving `.html` files directly; the old S3 alias copies are no longer published.
