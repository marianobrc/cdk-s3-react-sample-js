#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { CdkStack } = require('../lib/react-js-app-stack');
const { PipelineStack } = require('../lib/react-s3-pipeline-stack');
const { ReviewAppsPipelineStack } = require('../lib/review-apps-pipeline-stack')
const { ReviewAppsStack } = require('../lib/review-apps-stack')

const app = new cdk.App();
const webapp = new CdkStack(app, 'ReactJsAppStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
const webapPipeline = new PipelineStack(app, 'ReactJsPipelineStack', {
  webapp: webapp,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
// Another stack and pipeline for review apps
const reviewApps = new ReviewAppsStack(app, 'ReviewAppsStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
const pipeline = new ReviewAppsPipelineStack(app, 'ReviewAppsPipelineStack', {
  bucket: reviewApps.bucket,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
