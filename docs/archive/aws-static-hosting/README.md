# Archived: AWS S3 + CloudFront static hosting

**Decommissioned:** 2026-07-21

Production deploy now uses GitHub Pages only (`.github/workflows/pages.yml`). These files are kept for reference if you need to tear down or audit the old AWS stack.

See [docs/decisions/0002-github-pages-static-hosting.md](../../decisions/0002-github-pages-static-hosting.md).

## Tear down the CloudFormation stack (optional)

If the stack is still running in your AWS account:

```bash
aws cloudformation delete-stack \
  --region us-east-1 \
  --stack-name nfc-card-designer
```

Remove unused repository secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID`.
