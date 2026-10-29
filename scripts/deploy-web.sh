#!/usr/bin/env bash
# Build + deploy the web map to the disc-golf/ sibling prefix.
set -euo pipefail
cd "$(dirname "$0")/../web"

npm run build

BUCKET="bryanchasko.com"
PREFIX="disc-golf"
PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
REGION="us-west-2"
DISTRO="E2E9BSL5RVN6DI"

# Assets, long cache (no --delete: siblings share nothing here, but stay safe
# and let stale files be overwritten; removals are handled by explicit rm).
aws s3 sync dist/ "s3://${BUCKET}/${PREFIX}/" --profile "$PROFILE" --region "$REGION" \
	--cache-control "public, max-age=86400" --exclude "*.html"
aws s3 sync dist/ "s3://${BUCKET}/${PREFIX}/" --profile "$PROFILE" --region "$REGION" \
	--cache-control "no-cache, must-revalidate" --exclude "*" --include "*.html"
aws cloudfront create-invalidation --distribution-id "$DISTRO" \
	--paths "/${PREFIX}/*" --profile "$PROFILE" >/dev/null
echo "live: https://${BUCKET%.com}.com/${PREFIX}/ (invalidation running)"
