#!/usr/bin/env bash
# Deploy frontend to S3 + CloudFront
#
# This script builds the Cyberia frontend (Vite app) and deploys it to S3,
# then invalidates the CloudFront cache so changes are immediately live.
#
# Usage:
#   ./deploy.sh
#   ./deploy.sh --no-invalidate  # Skip CloudFront invalidation

set -e

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="cyberia-drawvid-frontend-$AWS_ACCOUNT_ID"
CLOUDFRONT_DIST_ID="EJDZHTYPQ4BNP"  # cyberia.drawvid.com distribution
SKIP_INVALIDATE="${1:---invalidate}"

echo "================================"
echo "🚀 Deploying Frontend"
echo "================================"
echo "S3 bucket:   $BUCKET_NAME"
echo "CloudFront:  $CLOUDFRONT_DIST_ID"
echo ""

# Build
echo "📦 Building frontend..."
npm run build

# Deploy to S3
echo ""
echo "📤 Deploying to S3..."
echo "   Assets (1h cache)..."
aws s3 sync dist/assets "s3://$BUCKET_NAME/assets" \
  --cache-control "public, max-age=3600" \
  --delete \
  --region us-east-2

echo "   index.html (no cache)..."
aws s3 cp dist/index.html "s3://$BUCKET_NAME/index.html" \
  --cache-control "public, max-age=0, must-revalidate" \
  --region us-east-2

# Invalidate CloudFront
if [[ "$SKIP_INVALIDATE" != "--no-invalidate" ]]; then
  echo ""
  echo "🔄 Invalidating CloudFront..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DIST_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)
  
  echo "   ID: $INVALIDATION_ID"
  echo "   Check status: aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_DIST_ID --id $INVALIDATION_ID"
  echo ""
  echo "✅ Frontend deployed! Cache invalidation in progress."
else
  echo ""
  echo "✅ Frontend deployed to S3 (invalidation skipped)"
fi

echo "   Access: https://cyberia.drawvid.com"
