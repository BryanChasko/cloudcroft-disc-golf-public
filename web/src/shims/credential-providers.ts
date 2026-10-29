// Browser-safe shim: the auth helper imports fromCognitoIdentityPool from the
// @aws-sdk/credential-providers barrel, which drags Node-only providers
// (credential-provider-login imports node:crypto/fs/os) into the web bundle.
// Re-export just what the browser path needs from the leaf package.
export { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
