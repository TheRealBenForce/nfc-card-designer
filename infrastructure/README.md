# AWS infrastructure

Static hosting for Zaparoo NFC Card Designer at `zaparoo.therealbenforce.com`.

## Stack (`cloudformation.yaml`)

Creates:

- **S3 bucket** (named after `DomainName`)
- **ACM certificate** with DNS validation in your Route53 hosted zone
- **CloudFront distribution** with HTTPS
- **Route53 A + AAAA** alias records pointing at CloudFront
- **IAM deploy user** with scoped S3 + CloudFront invalidation permissions (optional access key)

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

- `BucketName` → `S3_BUCKET` in `.env` / GitHub (workflow sets this automatically)
- `DistributionId` → GitHub secret `CLOUDFRONT_DISTRIBUTION_ID`
- `DeployUserAccessKeyId` → GitHub secret `AWS_ACCESS_KEY_ID`
- `DeployUserSecretAccessKey` → GitHub secret `AWS_SECRET_ACCESS_KEY` (**copy immediately** — only shown at stack create)

### Update an existing stack

If you already deployed the stack before the deploy user was added:

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

Then open **CloudFormation → Stacks → Outputs** and copy the new access key values.

ACM DNS validation records are created automatically when `HostedZoneId` is supplied.

### Deploy IAM user permissions

The `zaparoo-github-deploy` user (name configurable via `DeployUserName`) can:

| Action | Purpose |
|--------|---------|
| `s3:ListBucket` | `aws s3 sync` and `HeadObject` prefix listing |
| `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` | Site deploy + `fetch-images` uploads |
| `cloudfront:CreateInvalidation` | Bust cache after deploy |

Permissions are scoped to this stack's bucket and CloudFront distribution only.

## GitHub Actions

Workflow: `.github/workflows/deploy.yml`

Runs on every push to `main`:

1. `node scripts/deploy.mjs` — `aws s3 sync` site files + CloudFront invalidation

**Game images are not fetched in CI.** Run `npm run fetch-images` from your workstation when you need to upload thumbnails to S3.

### Required repository secrets

| Secret | Source |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | Stack output `DeployUserAccessKeyId` |
| `AWS_SECRET_ACCESS_KEY` | Stack output `DeployUserSecretAccessKey` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Stack output `DistributionId` |

### IAM permissions

Created automatically by the CloudFormation stack — see **Deploy IAM user permissions** above. No manual policy attachment needed.

If you use a separate workstation IAM user (for example, `ZaparooUploader`) and want `npm run deploy` to invalidate CloudFront too, attach an identity policy that includes `cloudfront:CreateInvalidation`.

Example policy JSON:

`infrastructure/policies/zaparoo-uploader-policy.json`

Apply it with AWS CLI:

```bash
aws iam put-user-policy \
  --user-name ZaparooUploader \
  --policy-name ZaparooUploaderInline \
  --policy-document file://infrastructure/policies/zaparoo-uploader-policy.json
```

## Local commands

```bash
cp .env.example .env
# fill AWS_* and S3_BUCKET

npm run fetch-images          # download + upload missing images to S3
npm run fetch-images -- --local-only   # disk only, no S3
npm run fetch-images -- --s3-only      # S3 only, no local image files
npm run fetch-images -- --libretro-dir=/path/to/thumbnails.libretro.com --s3-only
npm run deploy                # sync site to S3 + invalidate CloudFront (excludes assets/images/*)
```
