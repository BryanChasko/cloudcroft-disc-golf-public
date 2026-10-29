#!/usr/bin/env bash
# Create the public web map API key and stash the secret in SSM.
# Not in the CDK stack: the plaintext key exists only at creation time.
# Idempotent: deletes any existing key with the same name first.
set -euo pipefail
PROFILE="${AWS_PROFILE:-aerospaceug-admin}"
REGION="us-east-1"
KEY_NAME="cloudcroft-disc-golf-web"
ACCOUNT="211125425201"

aws location delete-key --profile "$PROFILE" --region "$REGION" --key-name "$KEY_NAME" 2>/dev/null || true
KEY_JSON=$(aws location create-key --profile "$PROFILE" --region "$REGION" \
	--key-name "$KEY_NAME" --no-expiry \
	--restrictions "AllowActions=geo-maps:*,geo-places:*,AllowResources=arn:aws:geo:${REGION}:${ACCOUNT}:map/cloudcroft-disc-golf-topo,arn:aws:geo:${REGION}:${ACCOUNT}:map/cloudcroft-disc-golf-imagery,arn:aws:geo:${REGION}:${ACCOUNT}:place-index/cloudcroft-disc-golf,AllowReferers=https://bryanchasko.com/*,https://www.bryanchasko.com/*")
KEY_VALUE=$(python3 -c "import json,sys; print(json.load(sys.stdin)['Key'])" <<<"$KEY_JSON")
aws ssm put-parameter --profile "$PROFILE" --region "$REGION" \
	--name "/cloudcroft-disc-golf/web-api-key" --type SecureString \
	--value "$KEY_VALUE" --overwrite --tier Standard >/dev/null
echo "key $KEY_NAME created; secret stored at /cloudcroft-disc-golf/web-api-key"
