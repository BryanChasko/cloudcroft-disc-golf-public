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

- CDK stack cloudcroft-disc-golf (us-east-1, deployed 2026-10-29):
  api https://sfss0zmepi.execute-api.us-east-1.amazonaws.com
  (GET /plays-like, GET+POST /scorecard)
- lambdas cloudcroft-disc-golf-plays-like + cloudcroft-disc-golf-scorecard
  (provided.al2023, arm64, musl-static, via CDK assets)
- DynamoDB cloudcroft-disc-golf-scorecards (PK round_id + SK entry, PITR, retain)
- Cognito identity pool us-east-1:6f67bf3e-988c-491a-ab4c-b89211a7f82d
  (guest access; serves web + android after the CreateKey block, see README)
- route calculator cloudcroft-disc-golf-routes (Esri)
- web bundle + dataset: s3://bryanchasko.com/disc-golf/ (us-west-2 site bucket,
  registered sibling prefix, served by the site CloudFront distro)
- orphaned clickops leftovers to delete: IAM role cloudcroft-disc-golf-lambda
