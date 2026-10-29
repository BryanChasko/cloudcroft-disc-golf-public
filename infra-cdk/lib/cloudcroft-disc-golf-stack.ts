import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognitoidentity from "aws-cdk-lib/aws-cognito-identitypool";
import * as location from "aws-cdk-lib/aws-location";
import { Construct } from "constructs";

/**
 * Cloudcroft disc golf backend, us-east-1.
 *
 * Location Service resources use stable L1s — the L2 package
 * (@aws-cdk/aws-location-alpha) is still experimental. Everything else is L2.
 * Construct IDs are stable: renaming one replaces its resource.
 */
export class CloudcroftDiscGolfStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------- Amazon Location Service (L1, stable) ----------
    const topoMap = new location.CfnMap(this, "TopoMap", {
      mapName: "cloudcroft-disc-golf-topo",
      configuration: { style: "VectorEsriTopographic" },
      description: "Hackathon: topo base map",
    });

    const imageryMap = new location.CfnMap(this, "ImageryMap", {
      mapName: "cloudcroft-disc-golf-imagery",
      configuration: { style: "RasterEsriImagery" },
      description: "Hackathon: satellite base map",
    });

    const placeIndex = new location.CfnPlaceIndex(this, "PlaceIndex", {
      indexName: "cloudcroft-disc-golf",
      dataSource: "Esri",
      description: "Hackathon: geocode course anchors",
    });

    const geofences = new location.CfnGeofenceCollection(
      this,
      "HoleGeofences",
      {
        collectionName: "cloudcroft-disc-golf-holes",
        description: "Hackathon: per-hole geofences",
      },
    );

    const tracker = new location.CfnTracker(this, "PlayerTracker", {
      trackerName: "cloudcroft-disc-golf-players",
      description: "Hackathon: player positions",
    });

    const routes = new location.CfnRouteCalculator(this, "Routes", {
      calculatorName: "cloudcroft-disc-golf-routes",
      dataSource: "Esri",
      description:
        "Hackathon: walking routes (parking to hole 1, between holes)",
    });

    const mapArns = [topoMap.attrArn, imageryMap.attrArn];

    // Web API key: intentionally NOT in this stack. the plaintext secret is only
    // returned at creation and CloudFormation cannot surface it, so the key is
    // created post-deploy via scripts/create-web-key.sh, which captures the
    // secret straight into SSM. same restrictions as designed: geo-maps:* +
    // geo-places:* on the two maps + place index, referer-locked to the site.

    // ---------- Cognito identity pool (Android guest auth, stable L2) ----------
    const pool = new cognitoidentity.IdentityPool(this, "GuestPool", {
      identityPoolName: "cloudcroft-disc-golf-guests",
      allowUnauthenticatedIdentities: true,
    });

    const locationStatements = [
      new iam.PolicyStatement({
        actions: [
          "geo:GetMapTile",
          "geo:GetMapSprites",
          "geo:GetMapGlyphs",
          "geo:GetMapStyleDescriptor",
        ],
        resources: mapArns,
      }),
      new iam.PolicyStatement({
        actions: [
          "geo:SearchPlaceIndexForText",
          "geo:SearchPlaceIndexForPosition",
          "geo:GetPlace",
        ],
        resources: [placeIndex.attrArn],
      }),
      new iam.PolicyStatement({
        actions: [
          "geo:BatchUpdateDevicePosition",
          "geo:GetDevicePosition",
          "geo:ListDevicePositions",
          "geo:BatchEvaluateGeofences",
          "geo:ListGeofences",
          "geo:GetGeofence",
        ],
        resources: [tracker.attrArn, geofences.attrArn],
      }),
      new iam.PolicyStatement({
        actions: ["geo:CalculateRoute"],
        resources: [routes.attrArn],
      }),
    ];
    for (const statement of locationStatements) {
      pool.unauthenticatedRole.addToPrincipalPolicy(statement);
      pool.authenticatedRole.addToPrincipalPolicy(statement);
    }

    // ---------- Rust lambdas (assets built by scripts/build-lambda-assets.sh) ----------
    const playsLike = new lambda.Function(this, "PlaysLike", {
      functionName: "cloudcroft-disc-golf-plays-like",
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: "bootstrap",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "assets", "plays-like"),
      ),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      description: "Hackathon: plays-like distance v0",
    });

    const scorecards = new dynamodb.Table(this, "Scorecards", {
      tableName: "cloudcroft-disc-golf-scorecards",
      partitionKey: { name: "round_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "entry", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    const scorecardFn = new lambda.Function(this, "Scorecard", {
      functionName: "cloudcroft-disc-golf-scorecard",
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: "bootstrap",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "assets", "scorecard"),
      ),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      description: "Hackathon: scorecard API",
      environment: { SCORECARD_TABLE: scorecards.tableName },
    });
    scorecards.grantReadWriteData(scorecardFn);

    // ---------- HTTP API ----------
    const api = new apigwv2.HttpApi(this, "Api", {
      apiName: "cloudcroft-disc-golf",
      description: "Hackathon: plays-like + scorecard API",
      corsPreflight: {
        allowOrigins: [
          "https://bryanchasko.com",
          "https://www.bryanchasko.com",
        ],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ["content-type", "authorization"],
      },
    });
    api.addRoutes({
      path: "/plays-like",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "PlaysLikeIntegration",
        playsLike,
      ),
    });
    api.addRoutes({
      path: "/scorecard",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "ScorecardIntegration",
        scorecardFn,
      ),
    });

    // ---------- outputs ----------
    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "IdentityPoolId", { value: pool.identityPoolId });
    new cdk.CfnOutput(this, "PlaceIndexArn", { value: placeIndex.attrArn });
  }
}
