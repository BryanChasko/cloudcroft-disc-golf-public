#!/usr/bin/env bash
# Publish /disc-golf/* redirect stubs, then clear the retired app files
# (the app now lives at /cloudcroft-disc-golf/app/). Keeps the two stubs
# and removes everything else under the old prefix.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="bryanchasko.com"
PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
REGION="us-west-2"
DISTRO="E2E9BSL5RVN6DI"

aws s3 sync redirects/disc-golf/ "s3://${BUCKET}/disc-golf/" \
	--profile "$PROFILE" --region "$REGION" \
	--cache-control "no-cache, must-revalidate" --exclude "*" --include "*.html"
aws s3 rm "s3://${BUCKET}/disc-golf" --recursive \
	--profile "$PROFILE" --region "$REGION" \
	--exclude "index.html" --exclude "walk.html"
aws cloudfront create-invalidation --distribution-id "$DISTRO" \
	--paths "/disc-golf/*" --profile "$PROFILE" >/dev/null
echo "redirects live: /disc-golf/* -> /cloudcroft-disc-golf/app/* (invalidation running)"
