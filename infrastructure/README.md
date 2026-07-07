# AWS infrastructure

Static hosting for Zaparoo NFC Card Designer at `zaparoo.therealbenforce.com`.

## Stack (`cloudformation.yaml`)

Creates:

- **S3 bucket** (named after `DomainName`)
- **ACM certificate** with DNS validation in your Route53 hosted zone
- **CloudFront distribution** with HTTPS
- **Route53 A + AAAA** alias records pointing at CloudFront

### Deploy the stack

**Must be deployed in `us-east-1`** (ACM requirement for CloudFront).

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name zaparoo-nfc-card-designer \
  --template-file infrastructure/cloudformation.yaml \
  --parameter-overrides \
    DomainName=zaparoo.therealbenforce.com \
    HostedZoneId=Z0123456789ABCDEFGHIJ \
  --capabilities CAPABILITY_IAM
```

Replace `HostedZoneId` with your Route53 zone ID for `therealbenforce.com`.

After deploy, note the outputs:

- `BucketName` → GitHub secret / `S3_BUCKET`
- `DistributionId` → GitHub secret `CLOUDFRONT_DISTRIBUTION_ID`

ACM DNS validation records are created automatically when `HostedZoneId` is supplied.

## GitHub Actions

Workflow: `.github/workflows/deploy.yml`

Runs on every push to `main`:

1. `npm run fetch-images` — downloads missing libretro thumbnails and uploads to S3 (skips existing objects)
2. `npm run deploy` — `aws s3 sync` site files + CloudFront invalidation

### Required repository secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | Deploy IAM user |
| `AWS_SECRET_ACCESS_KEY` | Deploy IAM user |
| `CLOUDFRONT_DISTRIBUTION_ID` | Cache invalidation after deploy |

### IAM permissions (minimum)

- `s3:ListBucket`, `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on the site bucket
- `cloudfront:CreateInvalidation` on the distribution

## Local commands

```bash
cp .env.example .env
# fill AWS_* and S3_BUCKET

npm run fetch-images          # download + upload missing images to S3
npm run fetch-images -- --local-only   # disk only, no S3
npm run deploy                # sync site to S3 + invalidate CloudFront
```
