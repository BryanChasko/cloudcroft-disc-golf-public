#!/usr/bin/env bash
# export-public.sh - create a public-friendly export of cloudcroft-disc-golf
# usage: ./scripts/export-public.sh

set -euo pipefail

# config
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMP_DIR=$(mktemp -d)
EXPORT_DIR="$TEMP_DIR/cloudcroft-disc-golf-open"
DEST_REPO="BryanChasko/cloudcroft-disc-golf-open"

echo "=== cloudcroft-disc-golf public export ==="
echo "source: $SRC_DIR"
echo "temp: $TEMP_DIR"
echo ""

# ============================================================
# allowlist-based copy
# ============================================================

mkdir -p "$EXPORT_DIR"

# README - use public README if it exists
if [ -f "$SRC_DIR/docs/public/README.md" ]; then
	cp "$SRC_DIR/docs/public/README.md" "$EXPORT_DIR/README.md"
	echo "[OK] README.md from docs/public/"
else
	cp "$SRC_DIR/README.md" "$EXPORT_DIR/README.md"
	echo "[OK] README.md from root"
fi

# web/ source (not dist, no node_modules)
echo "[COPY] web/"
mkdir -p "$EXPORT_DIR/web/src/pano"
cp -r "$SRC_DIR/web/src" "$EXPORT_DIR/web/"
cp "$SRC_DIR/web/index.html" "$EXPORT_DIR/web/"
cp "$SRC_DIR/web/walk.html" "$EXPORT_DIR/web/"
cp "$SRC_DIR/web/package.json" "$EXPORT_DIR/web/" 2>/dev/null || true
# shared dir
mkdir -p "$EXPORT_DIR/web/public/shared"
cp -r "$SRC_DIR/web/public/shared"/* "$EXPORT_DIR/web/public/shared/" 2>/dev/null || true
# data dir (derived data only)
mkdir -p "$EXPORT_DIR/web/public/data"
for f in holes trails naip survey-assets pano-index; do
	cp "$SRC_DIR/web/public/data/${f}"* "$EXPORT_DIR/web/public/data/" 2>/dev/null || true
done
# copy specific data files
cp "$SRC_DIR/web/public/data/panos"*.json "$EXPORT_DIR/web/public/data/" 2>/dev/null || true
cp "$SRC_DIR/web/public/data/osm"*.geojson "$EXPORT_DIR/web/public/data/" 2>/dev/null || true

# story/ source (not stock strips)
echo "[COPY] story/"
mkdir -p "$EXPORT_DIR/story"
cp "$SRC_DIR/story/index.html" "$EXPORT_DIR/story/"
# exclude stock strips: strip-*.webp
for f in "$SRC_DIR/story"/*; do
	basename=$(basename "$f")
	if [[ "$basename" == strip-*.webp ]]; then
		echo "[SKIP] story/$basename (stock strip)"
		continue
	fi
	cp -r "$f" "$EXPORT_DIR/story/"
done

# backend/ source (no target/)
echo "[COPY] backend/"
mkdir -p "$EXPORT_DIR/backend"
for dir in plays-like scorecard; do
	if [ -d "$SRC_DIR/backend/$dir" ]; then
		cp -r "$SRC_DIR/backend/$dir" "$EXPORT_DIR/backend/"
		rm -rf "$EXPORT_DIR/backend/$dir/target" 2>/dev/null || true
	fi
done
# pkg dir without binary artifacts
if [ -d "$SRC_DIR/backend/pkg" ]; then
	mkdir -p "$EXPORT_DIR/backend/pkg"
	cp "$SRC_DIR/backend/pkg/"*.json "$EXPORT_DIR/backend/pkg/" 2>/dev/null || true
	rm -f "$EXPORT_DIR/backend/pkg/"*.zip "$EXPORT_DIR/backend/pkg/function.zip" 2>/dev/null || true
fi

# infra-cdk/ source (no cdk.out, no dist, no assets)
echo "[COPY] infra-cdk/"
mkdir -p "$EXPORT_DIR/infra-cdk"
for f in "$SRC_DIR/infra-cdk"/*; do
	basename=$(basename "$f")
	if [[ "$basename" == cdk.out || "$basename" == dist || "$basename" == assets || "$basename" == node_modules ]]; then
		echo "[SKIP] infra-cdk/$basename"
		continue
	fi
	cp -r "$f" "$EXPORT_DIR/infra-cdk/"
done
# clean nested node_modules from imports
rm -rf "$EXPORT_DIR/infra-cdk"/*/node_modules 2>/dev/null || true

# dataset/scripts + tests
echo "[COPY] dataset/scripts/"
mkdir -p "$EXPORT_DIR/dataset/scripts/tests"
cp "$SRC_DIR/dataset/scripts/"*.py "$EXPORT_DIR/dataset/scripts/" 2>/dev/null
cp "$SRC_DIR/dataset/scripts/tests/"test_*.py "$EXPORT_DIR/dataset/scripts/tests/" 2>/dev/null
rm -f "$EXPORT_DIR/dataset/scripts/"*_incoming* 2>/dev/null || true

# derived dataset json files
echo "[COPY] derived dataset files..."
mkdir -p "$EXPORT_DIR/dataset"
for f in holes trails climate-normals survey-assets; do
	for ext in json geojson csv; do
		src="$SRC_DIR/dataset/${f}.${ext}"
		if [ -f "$src" ]; then
			# exclude incoming/raw survey originals
			if [[ "$f" == *"survey"* && "$f" != "survey-assets" ]]; then
				echo "[SKIP] $src (raw survey data)"
				continue
			fi
			cp "$src" "$EXPORT_DIR/dataset/"
		fi
	done
done
# panos-web small files only (webp + sidecar json)
mkdir -p "$EXPORT_DIR/dataset/panos-web"
for f in "$SRC_DIR/dataset/panos-web"/*; do
	ext="${f##*.}"
	if [[ "$ext" == webp || "$ext" == json ]]; then
		cp "$f" "$EXPORT_DIR/dataset/panos-web/"
	fi
done
# PANO-INDEX.md
cp "$SRC_DIR/dataset/PANO-INDEX.md" "$EXPORT_DIR/dataset/" 2>/dev/null || true

# media manifest
cp "$SRC_DIR/dataset/media-manifest.json" "$EXPORT_DIR/dataset/" 2>/dev/null || true

# dem/naip small derived files only (check size)
mkdir -p "$EXPORT_DIR/dataset/dem"
for f in course-area-grid course-area-naip; do
	src="$SRC_DIR/dataset/${f}"*
	if [ -f "$src" ]; then
		size=$(stat -c%s "$src" 2>/dev/null || stat -f%z "$src" 2>/dev/null || echo 0)
		if [ "$size" -lt 10000000 ]; then # <10MB
			cp "$src" "$EXPORT_DIR/dataset/"
		else
			echo "[SKIP] $src (too large, $(($size / 1000))KB)"
		fi
	fi
done

# docs/
echo "[COPY] docs/"
mkdir -p "$EXPORT_DIR/docs"
for f in "$SRC_DIR/docs"/*; do
	basename=$(basename "$f")
	# include pptx, markdown docs
	if [[ "$basename" == *.pptx || "$basename" == *.md ]]; then
		# exclude _incoming files
		if [[ "$basename" == *_incoming* ]]; then
			echo "[SKIP] docs/$basename (incoming)"
			continue
		fi
		cp "$f" "$EXPORT_DIR/docs/"
	fi
done

# LICENSE
echo "[COPY] LICENSE..."
cat >"$EXPORT_DIR/LICENSE" <<'EOF'
MIT License

Copyright (c) 2026 Bryan Chasko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# add CC-BY note to README footer (README is already copied)

# ============================================================
# sanitize sensitive values in all text files
# ============================================================

echo ""
echo "=== sanitizing sensitive values ==="

# account id
find "$EXPORT_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" -o -name "*.sh" \) -exec sed -i '' 's/211125425201/<ACCOUNT_ID>/g' {} \;
echo "[SANITIZE] account ID 211125425201 -> <ACCOUNT_ID>"

# execute-api hostnames
find "$EXPORT_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \) -exec sed -i '' 's/sfss0zmepi\.<API_ID>/<API_ID>/g' {} \;
find "$EXPORT_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \) -exec sed -i '' 's/[a-z0-9]\{12,\}\.execute-api\.<API_ID>/<API_ID>/g' {} \;
echo "[SANITIZE] execute-api hostnames -> <API_ID>"

# cognito identity pool ids
find "$EXPORT_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \) -exec sed -i '' 's/us-east-1:[a-f0-9-]\{36\}/<IDENTITY_POOL_ID>/g' {} \;
echo "[SANITIZE] cognito identity pool IDs -> <IDENTITY_POOL_ID>"

# AKIA access keys (shouldn't be any, but catch-all)
find "$EXPORT_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \) -exec sed -i '' 's/AKIA[0-9A-Z]{16}/<ACCESS_KEY>/g' {} \;
echo "[SANITIZE] AKIA access keys -> <ACCESS_KEY>"

# ============================================================
# create fresh git repo (no history)
# ============================================================

echo ""
echo "=== creating fresh git repo ==="

cd "$EXPORT_DIR"
git init
git add .
git commit -m "initial commit: public export of cloudcroft-disc-golf

code: MIT
docs and media: CC-BY 4.0

see README for full documentation."

# ============================================================
# summary
# ============================================================

echo ""
echo "=== export complete ==="
echo "export directory: $EXPORT_DIR"
echo ""
echo "file count: $(find "$EXPORT_DIR" -type f | wc -l)"
echo ""
echo "to push to github:"
echo "  gh repo create $DEST_REPO --public --description 'Cloudcroft disc golf: a virtual course walkthrough built from a ground survey + AWS open data'"
echo "  cd $EXPORT_DIR && git remote add origin https://github.com/$DEST_REPO.git"
echo "  git push -u origin main"
echo ""
echo "files copied:"
find "$EXPORT_DIR" -type f | sed "s|$EXPORT_DIR|  ." | sort
