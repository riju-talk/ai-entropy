import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class EntropyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for private resources
    const vpc = new ec2.Vpc(this, 'EntropyVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // S3 Bucket for documents
    const documentsBucket = new s3.Bucket(this, 'EntropyDocumentsBucket', {
      bucketName: cdk.Stack.of(this).stackName === 'dev' 
        ? 'entropy-documents-dev' 
        : `entropy-documents-${cdk.Stack.of(this).account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // RDS PostgreSQL
    const database = new rds.DatabaseInstance(this, 'EntropyDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceIdentifier: 'entropy-db',
      instanceClass: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.SMALL,
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      multiAz: true,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      credentials: rds.Credentials.fromGeneratedSecret('entropy_admin', {
        secretName: `${cdk.Stack.of(this).stackName}/entropy/db-credentials`,
      }),
      databaseName: 'entropy',
      deletionProtection: true,
      backupRetention: cdk.Duration.days(7),
    });

    // Neo4j (using AWS Managed Graph Database or Neo4j Aura)
    // For production, consider AWS Managed Graph Database or Neo4j Aura
    const neo4jEndpoint = new ssm.StringParameter(this, 'Neo4jEndpoint', {
      parameterName: `/${cdk.Stack.of(this).stackName}/entropy/NEO4J_URI`,
      stringValue: 'bolt://<neo4j-endpoint>:7687',
    });

    // Lambda Function
    const entropyLambda = new lambdaNode.NodejsFunction(this, 'EntropyApiFunction', {
      entry: 'apps/ai-agent/lambda_handler.py',
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_11,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      architecture: lambda.Architecture.X86_64,
      environment: {
        APP_ENV: cdk.Stack.of(this).stackName,
        AI_PROVIDER: 'bedrock',
        BEDROCK_CLAUDE_MODEL: 'anthropic.claude-3-sonnet-20240229-v1:0',
        BEDROCK_TITAN_EMBED: 'amazon.titan-embed-text-v2:0',
        AWS_REGION: this.region,
        DATABASE_URL: `postgresql://${database.secret?.secretValueFromJson('username')}:${database.secret?.secretValueFromJson('password')}@${database.instanceEndpoint.hostname}:5432/entropy`,
        S3_BUCKET_NAME: documentsBucket.bucketName,
        NEO4J_URI: neo4jEndpoint.parameterName,
        REDIS_HOST: '<redis-endpoint>',
        JWT_SECRET_KEY: '<generate-secure-random-key>',
      },
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
        vpc,
        description: 'Security group for Entropy Lambda',
        allowAllOutbound: true,
      })],
    });

    // Grant permissions
    documentsBucket.grantReadWrite(entropyLambda);
    database.secret?.grantRead(entropyLambda);

    // API Gateway
    const api = new apigateway.RestApi(this, 'EntropyApi', {
      restApiName: 'Entropy API',
      description: 'Entropy AI Engine API',
      deployOptions: {
        stageName: cdk.Stack.of(this).stackName,
      },
    });

    const integration = new apigateway.LambdaIntegration(entropyLambda, {
      proxy: true,
    });

    api.root.addMethod('ANY', integration);
    api.root.addResource('{proxy+}').addMethod('ANY', integration);

    // CloudWatch Alarms
    new cloudwatch.Alarm(this, 'EntropyApiErrorRate', {
      metric: entropyLambda.metricErrors({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmName: 'Entropy API Error Rate',
    });

    new cloudwatch.Alarm(this, 'EntropyApiLatency', {
      metric: entropyLambda.metricDuration({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3500,
      evaluationPeriods: 1,
      alarmName: 'Entropy API Latency',
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url || '',
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'DocumentsBucket', {
      value: documentsBucket.bucketName,
      description: 'Documents S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'RDS Database Endpoint',
    });
  }
}
