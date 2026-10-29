# infra

all hackathon infra lives in account 211125425201 (aerospaceug-admin, the
websites account), region us-east-1. no bryanchasko-kiro profile exists on the
build machine, and the site + CDN already live here.

## Amazon Location Service (created 2026-10-29)

| resource                    | name                         |
| --------------------------- | ---------------------------- |
| place index (Esri)          | cloudcroft-disc-golf         |
| map (VectorEsriTopographic) | cloudcroft-disc-golf-topo    |
| map (RasterEsriImagery)     | cloudcroft-disc-golf-imagery |
| geofence collection         | cloudcroft-disc-golf-holes   |
| tracker                     | cloudcroft-disc-golf-players |

## geocoded anchors (provisional, replaced by ground GPS)

| anchor                    | label                                         | lon        | lat      |
| ------------------------- | --------------------------------------------- | ---------- | -------- |
| Byron Ligon / Zenith Park | Zenith Park, Cloudcroft, NM, USA              | -105.73887 | 32.95787 |
| Community course          | 230 Mescalero Ave, Cloudcroft, NM, 88317, USA | -105.73996 | 32.96320 |

## to create

- lambda cloudcroft-disc-golf-plays-like (provided.al2023, arm64, live + verified 2026-10-29)
- S3 bucket for dataset + web hosting (name tbd, cloudcroft-disc-golf-* free check first)
- HTTP API in front of plays-like + scorecard table (DynamoDB on-demand)
- CloudFront distro in front of the bucket (or reuse site pipeline)
