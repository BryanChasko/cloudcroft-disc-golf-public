#!/usr/bin/env bash
# Deploy the hackathon story page to the cloudcroft-disc-golf/ prefix.
set -euo pipefail
cd "$(dirname "$0")/../story"

BUCKET="bryanchasko.com"
PREFIX="cloudcroft-disc-golf"
PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
REGION="${AWS_REGION:-us-west-2}"
DISTRO="E2E9BSL5RVN6DI"

aws s3 sync . "s3://${BUCKET}/${PREFIX}/" --profile "$PROFILE" --region "$REGION" \
	--cache-control "public, max-age=86400" --exclude "*.html"
aws s3 sync . "s3://${BUCKET}/${PREFIX}/" --profile "$PROFILE" --region "$REGION" \
	--cache-control "no-cache, must-revalidate" --exclude "*" --include "*.html"
aws cloudfront create-invalidation --distribution-id "$DISTRO" \
	--paths "/${PREFIX}/*" --profile "$PROFILE" >/dev/null
echo "live: https://${BUCKET%.com}.com/${PREFIX}/ (invalidation running)"
