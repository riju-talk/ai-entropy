import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Stack Props
// ─────────────────────────────────────────────────────────────────────────────

export interface NovyraStackProps extends cdk.StackProps {
  stage: "dev" | "staging" | "prod";
  neo4jUri?: string;       // inject from secrets manager in CI
  aiBackendToken: string;  // shared secret — Next.js ↔ AI engine
}

// ─────────────────────────────────────────────────────────────────────────────
// NovyraStack
// ─────────────────────────────────────────────────────────────────────────────

export class NovyraStack extends cdk.Stack {
  /** HTTP API Gateway URL — injected into Next.js Amplify env */
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: NovyraStackProps) {
    super(scope, id, props);

    const { stage, aiBackendToken, neo4jUri = "" } = props;
    const region = this.region;

    // ── VPC ─────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, "NovyraVpc", {
      maxAzs: 2,
      natGateways: stage === "prod" ? 1 : 0,
      subnetConfiguration: [
        { name: "public",   subnetType: ec2.SubnetType.PUBLIC,            cidrMask: 24 },
        { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED,  cidrMask: 24 },
      ],
    });

    // ── RDS PostgreSQL ───────────────────────────────────────────────────────
    const dbSg = new ec2.SecurityGroup(this, "DbSg", { vpc, allowAllOutbound: true });

    const dbInstance = new rds.DatabaseInstance(this, "NovyraDb", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3, stage === "prod" ? ec2.InstanceSize.MEDIUM : ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      databaseName: "novyra",
      credentials: rds.Credentials.fromGeneratedSecret("novyra_admin"),
      removalPolicy: stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      deletionProtection: stage === "prod",
      backupRetention: stage === "prod" ? cdk.Duration.days(7) : cdk.Duration.days(1),
    });

    // ── S3 Document Bucket ───────────────────────────────────────────────────
    const documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      bucketName: `novyra-documents-${stage}-${this.account}`,
      removalPolicy: stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== "prod",
      cors: [{
        allowedHeaders: ["*"],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
        allowedOrigins: ["*"],
        maxAge: 3600,
      }],
      lifecycleRules: [{
        id: "delete-processed-90d",
        prefix: "processed/",
        expiration: cdk.Duration.days(90),
      }],
    });

    // ── Lambda Security Group ────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, "LambdaSg", { vpc, allowAllOutbound: true });
    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to RDS");

    // ── IAM Role ─────────────────────────────────────────────────────────────
    const lambdaRole = new iam.Role(this, "NovyraLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
      ],
    });

    // Bedrock permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`,
      ],
    }));

    // S3 permissions
    documentsBucket.grantReadWrite(lambdaRole);

    // Secrets Manager — RDS credentials
    dbInstance.secret?.grantRead(lambdaRole);

    // ── Lambda Function ───────────────────────────────────────────────────────
    const aiEngine = new lambda.Function(this, "NovyraAiEngine", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, "../../apps/ai-agent"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            "bash", "-c",
            "pip install -r requirements.txt -t /asset-output && cp -au . /asset-output",
          ],
        },
      }),
      handler: "lambda_handler.handler",
      role: lambdaRole,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSg],
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.TWO_WEEKS,
      environment: {
        AI_PROVIDER:          "bedrock",
        BEDROCK_CLAUDE_MODEL: "anthropic.claude-3-sonnet-20240229-v1:0",
        BEDROCK_TITAN_EMBED:  "amazon.titan-embed-text-v2:0",
        AWS_REGION:            region,
        S3_BUCKET_NAME:        documentsBucket.bucketName,
        AI_BACKEND_TOKEN:      aiBackendToken,
        NEO4J_URI:             neo4jUri,
        // DATABASE_URL injected at runtime from Secrets Manager via Lambda init
      },
    });

    // ── API Gateway HTTP API ──────────────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, "NovyraHttpApi", {
      apiName: `novyra-ai-engine-${stage}`,
      description: "NOVYRA AI Engine — Claude 3 Sonnet + Titan Embeddings",
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    api.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new apigwv2_integrations.HttpLambdaIntegration("AiEngineIntegration", aiEngine),
    });

    this.apiUrl = api.apiEndpoint;

    // ── SSM Outputs ────────────────────────────────────────────────────────────
    new ssm.StringParameter(this, "ApiUrlParam", {
      parameterName: `/novyra/${stage}/AI_ENGINE_URL`,
      stringValue: api.apiEndpoint,
    });

    // ── CloudFormation Outputs ────────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint,
      description: "AI Engine HTTP API endpoint — set as NEXT_PUBLIC_BACKEND_URL in Amplify",
    });
    new cdk.CfnOutput(this, "DocumentsBucketName", {
      value: documentsBucket.bucketName,
    });
    new cdk.CfnOutput(this, "DbInstanceEndpoint", {
      value: dbInstance.dbInstanceEndpointAddress,
    });
  }
}
