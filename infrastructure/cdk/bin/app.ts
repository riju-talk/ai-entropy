#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NovyraStack } from "../lib/novyra-stack";

const app = new cdk.App();

const stage = (process.env.STAGE ?? "dev") as "dev" | "staging" | "prod";

new NovyraStack(app, `NovyraStack-${stage}`, {
  stage,
  aiBackendToken: process.env.AI_BACKEND_TOKEN ?? "change-me-in-production",
  neo4jUri:       process.env.NEO4J_URI ?? "",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  tags: {
    Project:     "NOVYRA",
    Environment: stage,
    ManagedBy:   "CDK",
  },
});
