#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CloudcroftDiscGolfStack } from "../lib/cloudcroft-disc-golf-stack";

const app = new cdk.App();
new CloudcroftDiscGolfStack(app, "CloudcroftDiscGolf", {
  stackName: "cloudcroft-disc-golf",
  env: { account: "211125425201", region: "us-east-1" },
  description: "AR map + scorecard for Cloudcroft NM disc golf (hackathon)",
});
cdk.Tags.of(app).add("Project", "cloudcroft-disc-golf");
