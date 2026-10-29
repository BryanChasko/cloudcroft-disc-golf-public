#!/usr/bin/env bash
# Build Rust lambda assets for the CDK stack (static musl ARM64 via cross).
# musl, not gnu: the cross gnu image links glibc 2.38+ but provided.al2023
# ships glibc 2.34, which fails at init. static binaries have no libc dep.
# Output: infra-cdk/assets/<name>/bootstrap (CDK zips the directory).
set -euo pipefail
cd "$(dirname "$0")/../backend"

for crate in plays-like scorecard; do
	echo "=== $crate ==="
	cross build --target aarch64-unknown-linux-musl --release --package "$crate"
	out="../infra-cdk/assets/$crate"
	mkdir -p "$out"
	cp "target/aarch64-unknown-linux-musl/release/$crate" "$out/bootstrap"
done
echo "assets ready under infra-cdk/assets/"
