import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class EntropyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || 'dev';
    const appRoot = '../../../apps/ai-agent';

    // ── VPC ────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'EntropyVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ── S3 Bucket for documents ────────────────────────────────────────────
    const documentsBucket = new s3.Bucket(this, 'EntropyDocumentsBucket', {
      bucketName: `entropy-documents-${stage}`,
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

    // ── RDS PostgreSQL ─────────────────────────────────────────────────────
    const database = new rds.DatabaseInstance(this, 'EntropyDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceIdentifier: `entropy-db-${stage}`,
      instanceClass: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.SMALL,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      multiAz: stage === 'prod',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      credentials: rds.Credentials.fromGeneratedSecret('entropy_admin', {
        secretName: `entropy/${stage}/db-credentials`,
      }),
      databaseName: 'entropy',
      deletionProtection: stage === 'prod',
      backupRetention: cdk.Duration.days(7),
    });

    // ── SQS Queues (async mastery + gamification workers) ─────────────────
    const masteryDlq = new sqs.Queue(this, 'MasteryDLQ', {
      queueName: `entropy-mastery-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const masteryQueue = new sqs.Queue(this, 'MasteryQueue', {
      queueName: `entropy-mastery-queue-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: { queue: masteryDlq, maxReceiveCount: 3 },
    });

    const gamificationDlq = new sqs.Queue(this, 'GamificationDLQ', {
      queueName: `entropy-gamification-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const gamificationQueue = new sqs.Queue(this, 'GamificationQueue', {
      queueName: `entropy-gamification-queue-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: { queue: gamificationDlq, maxReceiveCount: 3 },
    });

    // ── Shared Lambda security group ───────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Entropy Lambda functions',
      allowAllOutbound: true,
    });

    // ── Shared Lambda role ─────────────────────────────────────────────────
    const lambdaRole = new iam.Role(this, 'EntropyLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });
    // Bedrock
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
      ],
    }));
    // S3
    documentsBucket.grantReadWrite(lambdaRole);
    // SQS send (for api Lambda)
    masteryQueue.grantSendMessages(lambdaRole);
    gamificationQueue.grantSendMessages(lambdaRole);
    // SQS consume (for worker Lambdas)
    masteryQueue.grantConsumeMessages(lambdaRole);
    gamificationQueue.grantConsumeMessages(lambdaRole);
    // SSM
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/entropy/${stage}/*`],
    }));
    // RDS secret
    database.secret?.grantRead(lambdaRole);

    // ── Common Lambda environment ──────────────────────────────────────────
    const commonEnv: Record<string, string> = {
      APP_ENV: stage,
      IS_LAMBDA: 'true',
      AI_PROVIDER: 'bedrock',
      BEDROCK_CLAUDE_MODEL: 'anthropic.claude-3-sonnet-20240229-v1:0',
      BEDROCK_TITAN_EMBED: 'amazon.titan-embed-text-v2:0',
      AWS_DEFAULT_REGION: this.region,
      S3_BUCKET_NAME: documentsBucket.bucketName,
      MASTERY_QUEUE_URL: masteryQueue.queueUrl,
      GAMIFICATION_QUEUE_URL: gamificationQueue.queueUrl,
      // SSM-backed secrets (resolved at runtime by the app via ssm SDK or env vars set by serverless)
      DATABASE_URL: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/DATABASE_URL`),
      NEO4J_URI: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/NEO4J_URI`),
      NEO4J_USER: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/NEO4J_USER`),
      NEO4J_PASSWORD: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/NEO4J_PASSWORD`),
      REDIS_HOST: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/REDIS_HOST`),
      REDIS_PORT: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/REDIS_PORT`),
      JWT_SECRET_KEY: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/JWT_SECRET_KEY`),
      TAVILY_API_KEY: ssm.StringParameter.valueForStringParameter(this, `/entropy/${stage}/TAVILY_API_KEY`),
    };

    // ── Helper: create a Python Lambda ────────────────────────────────────
    const makeLambda = (id: string, handler: string, opts: Partial<lambda.FunctionProps> = {}) =>
      new lambda.Function(this, id, {
        runtime: lambda.Runtime.PYTHON_3_11,
        code: lambda.Code.fromAsset(appRoot),
        handler,
        role: lambdaRole,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [lambdaSg],
        environment: commonEnv,
        architecture: lambda.Architecture.X86_64,
        ...opts,
      });

    // ── RAG worker (Pinecone retrieval, invoked in parallel by api) ────────
    const ragWorker = makeLambda('RagWorker', 'app.workers.rag_worker.handler', {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(15),
      description: 'Pinecone semantic search — parallel fan-out',
    });

    // ── Tavily worker (live web search, invoked in parallel by api) ────────
    const tavilyWorker = makeLambda('TavilyWorker', 'app.workers.tavily_worker.handler', {
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      description: 'Tavily web search — parallel fan-out',
    });

    // ── Main API Lambda (FastAPI via Mangum) ───────────────────────────────
    const apiLambda = makeLambda('EntropyApiFunction', 'lambda_handler.handler', {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      description: 'Entropy FastAPI — all routes via Mangum',
      environment: {
        ...commonEnv,
        RAG_WORKER_FUNCTION: ragWorker.functionName,
        TAVILY_WORKER_FUNCTION: tavilyWorker.functionName,
      },
    });
    // Allow api lambda to invoke rag + tavily workers
    ragWorker.grantInvoke(apiLambda);
    tavilyWorker.grantInvoke(apiLambda);

    // ── Mastery worker (SQS-triggered) ─────────────────────────────────────
    const masteryWorker = makeLambda('MasteryWorker', 'app.workers.mastery_worker.handler', {
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'Bayesian mastery update — SQS consumer',
    });
    masteryWorker.addEventSource(new lambdaEventSources.SqsEventSource(masteryQueue, {
      batchSize: 10,
      reportBatchItemFailures: true,
    }));

    // ── Gamification worker (SQS-triggered) ────────────────────────────────
    const gamificationWorker = makeLambda('GamificationWorker', 'app.workers.gamification_worker.handler', {
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      description: 'XP + achievements + streak — SQS consumer',
    });
    gamificationWorker.addEventSource(new lambdaEventSources.SqsEventSource(gamificationQueue, {
      batchSize: 10,
      reportBatchItemFailures: true,
    }));

    // ── API Gateway ────────────────────────────────────────────────────────
    const apigw = new apigateway.RestApi(this, 'EntropyApi', {
      restApiName: `entropy-api-${stage}`,
      description: 'Entropy AI Engine API Gateway',
      deployOptions: { stageName: stage },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
    const integration = new apigateway.LambdaIntegration(apiLambda, { proxy: true });
    apigw.root.addMethod('ANY', integration);
    apigw.root.addResource('{proxy+}').addMethod('ANY', integration);

    // ── CloudWatch Alarms ──────────────────────────────────────────────────
    new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      metric: apiLambda.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmName: `entropy-api-errors-${stage}`,
    });
    new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      metric: apiLambda.metricDuration({ period: cdk.Duration.minutes(5) }),
      threshold: 3500,
      evaluationPeriods: 1,
      alarmName: `entropy-api-latency-${stage}`,
    });

    // ── Outputs ────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apigw.url,
      description: 'API Gateway URL — set as NEXT_PUBLIC_API_URL in Amplify',
    });
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: documentsBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'MasteryQueueUrl', {
      value: masteryQueue.queueUrl,
    });
    new cdk.CfnOutput(this, 'GamificationQueueUrl', {
      value: gamificationQueue.queueUrl,
    });
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
    });
  }
}


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
