# infra-cdk

TypeScript CDK app. one stack (`cloudcroft-disc-golf`), account 211125425201,
region us-east-1. Location Service resources use stable L1s (the L2 package is
still `@aws-cdk/aws-location-alpha`, experimental). everything else is L2.

## first time

```sh
npm install
./scripts/build-lambda-assets.sh   # cross -> infra-cdk/assets/*/bootstrap
eval "$(aws configure export-credentials --profile aerospaceug-admin --format env)"
npx cdk bootstrap aws://211125425201/us-east-1
```

CDK CLI note: this box's SSO profiles don't resolve inside the CDK CLI
("no credentials have been configured" despite a valid `aws sts`
identity), so every cdk command runs with exported session credentials as
above. re-export when they expire (~1h).

## every deploy

```sh
./scripts/build-lambda-assets.sh
eval "$(aws configure export-credentials --profile aerospaceug-admin --format env)"
npx cdk synth --strict
npx cdk diff
npx cdk deploy --require-approval never
```

lambda assets MUST be rebuilt before deploy: the stack hashes
`infra-cdk/assets/*/bootstrap`, and stale bytes deploy silently.

## rust lambda builds

target is `aarch64-unknown-linux-musl` (static). the default gnu target
links the cross image's glibc 2.38+, which `provided.al2023` (glibc 2.34)
rejects at init — scorecard died this way on day 0. musl has no runtime
libc dependency. cargo-lambda's bundled zig is unusable with rustc 1.99
(`--fix-cortex-a53-843419` rejected), hence `cross`.

## web map API key (currently blocked)

`scripts/create-web-key.sh` creates the referer-locked key and stores the
secret in SSM `/cloudcroft-disc-golf/web-api-key`. as of day 0,
`geo:CreateKey` is denied account-side even for AdministratorAccess
("no resource-based policy allows the action", same via CloudFormation),
so the web client authenticates through the Cognito guest pool like
Android until the key path is unblocked. retry the script; on success the
web build switches to the key with a one-line change.
