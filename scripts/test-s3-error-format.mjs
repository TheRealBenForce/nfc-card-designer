#!/usr/bin/env node

import { formatAwsError } from "./s3-storage.mjs";

const originalEnv = {
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};

try {
  process.env.AWS_REGION = "us-east-1";
  process.env.S3_BUCKET = "example-bucket";
  process.env.AWS_ACCESS_KEY_ID = "ABCD1234567890";
  process.env.AWS_SECRET_ACCESS_KEY = "secret";

  const err = /** @type {Error & { code?: string; $metadata?: { httpStatusCode?: number; requestId?: string } }} */ (
    new Error("The authorization header is malformed; region is wrong")
  );
  err.name = "UnknownError";
  err.code = "PermanentRedirect";
  err.$metadata = { httpStatusCode: 301, requestId: "req-123" };

  const message = formatAwsError(err, "Failed to check S3 object s3://example-bucket/foo.png");
  if (!message.includes("Failed to check S3 object")) {
    throw new Error("Expected context message in formatted AWS error");
  }
  if (!message.includes("status=301")) {
    throw new Error("Expected HTTP status in formatted AWS error");
  }
  if (!message.includes("requestId=req-123")) {
    throw new Error("Expected request ID in formatted AWS error");
  }
  if (!message.includes("Check AWS_REGION matches the bucket's region")) {
    throw new Error("Expected region hint in formatted AWS error");
  }
  if (!message.includes("AWS_SECRET_ACCESS_KEY=<set>")) {
    throw new Error("Expected env summary in formatted AWS error");
  }

  const unknownHeadErr =
    /** @type {Error & { $response?: { statusCode?: number; headers?: Record<string, string> } }} */ (
      new Error("UnknownError")
    );
  unknownHeadErr.name = "Unknown";
  unknownHeadErr.$response = {
    statusCode: 301,
    headers: {
      "x-amz-bucket-region": "us-west-2",
      "x-amz-request-id": "req-456",
      "x-amz-id-2": "ext-789",
    },
  };

  const unknownMessage = formatAwsError(
    unknownHeadErr,
    "Failed to check S3 object s3://example-bucket/bar.png",
  );
  if (!unknownMessage.includes("status=301")) {
    throw new Error("Expected fallback response status in unknown HEAD error");
  }
  if (!unknownMessage.includes("bucketRegion=us-west-2")) {
    throw new Error("Expected bucket region detail in unknown HEAD error");
  }
  if (!unknownMessage.includes("set AWS_REGION=us-west-2")) {
    throw new Error("Expected explicit AWS_REGION hint from bucket-region header");
  }
  if (!unknownMessage.includes("S3 often omits a body for HEAD errors")) {
    throw new Error("Expected explanatory hint for UnknownError from HeadObject");
  }

  console.log("✓ formatAwsError includes AWS details and setup hints");
} finally {
  if (originalEnv.AWS_REGION === undefined) delete process.env.AWS_REGION;
  else process.env.AWS_REGION = originalEnv.AWS_REGION;

  if (originalEnv.S3_BUCKET === undefined) delete process.env.S3_BUCKET;
  else process.env.S3_BUCKET = originalEnv.S3_BUCKET;

  if (originalEnv.AWS_ACCESS_KEY_ID === undefined) delete process.env.AWS_ACCESS_KEY_ID;
  else process.env.AWS_ACCESS_KEY_ID = originalEnv.AWS_ACCESS_KEY_ID;

  if (originalEnv.AWS_SECRET_ACCESS_KEY === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
  else process.env.AWS_SECRET_ACCESS_KEY = originalEnv.AWS_SECRET_ACCESS_KEY;
}
