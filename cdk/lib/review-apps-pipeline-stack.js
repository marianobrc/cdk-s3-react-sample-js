const cdk = require('@aws-cdk/core');
const { App, Stack, StackProps, SecretValue } = require('@aws-cdk/core');
const codebuild = require('@aws-cdk/aws-codebuild');
const codepipeline = require('@aws-cdk/aws-codepipeline');
const codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
const codestarconnections = require('@aws-cdk/aws-codestarconnections')
const ssm = require("@aws-cdk/aws-ssm");
const iam = require("@aws-cdk/aws-iam");
const { CdkStack } = require('./react-js-app-stack');


class ReviewAppsPipelineStack extends Stack{
    constructor(app, id, props) {
        super(app, id, props);
        const bucket = props.bucket;
        const sourceOutput = new codepipeline.Artifact();
        const buildOutput = new codepipeline.Artifact();

        // Parameters to get the source code from GH
        const webhooksSecret = cdk.SecretValue.secretsManager('/cdk-react-js-sample/prod', {jsonField:'GITHUB_WEBHOOKS_TOKEN'});
        const secret = cdk.SecretValue.secretsManager('/cdk-react-js-sample/prod', {jsonField:'GITHUB_TOKEN'});
        const repo = cdk.SecretValue.secretsManager('/cdk-react-js-sample/prod', {jsonField:'GITHUB_REPO'}).toString();
        const owner = cdk.SecretValue.secretsManager('/cdk-react-js-sample/prod', {jsonField:'GITHUB_OWNER'}).toString();

        // Build project to build the app code
        const appBuildProject = new codebuild.PipelineProject(this, "AppBuildProject", {
            buildSpec: codebuild.BuildSpec.fromObject({
            version: "0.2",
            phases: {
                install: {
                    commands: [
                        "npm i"
                    ]
                },
                build: {
                    commands: "npm run build && ls -alh"
                }
            },
            artifacts: {
                "base-directory": "build",
                files: [
                    "**/*",
                    "index.html"
                ]
            }
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0
            }
        });

        // Build project to run automatic tests
        const testsBuildProject = new codebuild.PipelineProject(this, "TestsBuildProject", {
            buildSpec: codebuild.BuildSpec.fromObject({
            version: "0.2",
            phases: {
                install: {
                    commands: [
                        "npm i"
                    ]
                },
                build: {
                    commands: "npm run test -- --watchAll=false"
                }
            }
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0
            }
        });

        // let ghConnection = new codestarconnections.CfnConnection(
        //     this,
        //     "CodeStarConnectionGH",{
        //         connectionName: "GitHubConnectionReviewApps",
        //         providerType: "GitHub"
        //     }
        // )
        // let ghPRAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
        //     actionName: 'Github_PR',
        //     branch: 'master',
        //     connectionArn: ghConnection.connection_arn,
        //     owner: owner,
        //     repo: repo,
        //     output: sourceOutput,
        //     triggerOnPush: false
        //     //trigger: codepipeline_actions.GitHubTrigger.NONE
        // });
        let ghPRAction = new codepipeline_actions.GitHubSourceAction({
            actionName: 'Github_PR',
            owner: owner,
            repo: repo,
            oauthToken: secret,
            output: sourceOutput,
            trigger: codepipeline_actions.GitHubTrigger.NONE
        })
        // The pipeline
        let reviewPipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            restartExecutionOnUpdate: true,
            stages: [
              {
                stageName: 'Source',
                actions: [
                    ghPRAction
                ],
              },
              {
                stageName: 'Test',
                actions: [
                    new codepipeline_actions.CodeBuildAction({
                        actionName: 'Automatic_Tests',
                        project: testsBuildProject,
                        input: sourceOutput,
                    }),
                ],
              },
              {
                stageName: 'Build',
                actions: [
                    new codepipeline_actions.CodeBuildAction({
                        actionName: 'App_Build',
                        project: appBuildProject,
                        input: sourceOutput,
                        outputs: [buildOutput],
                    }),
                ],
              },

              {
                stageName: 'Deploy',
                actions: [
                    new codepipeline_actions.S3DeployAction({
                        actionName: 'Deploy_to_S3',
                        input: buildOutput,
                        bucket: bucket
                    })
                ],
              }
            ],
          });
          // Connect GH webhooks to the pipeline and filter events for opened PRs
          new codepipeline.CfnWebhook(this, 'WebhookResource', {
            authentication: 'GITHUB_HMAC',
            authenticationConfiguration: {
              secretToken: webhooksSecret,
            },
            filters: [
              {
                jsonPath: '$.action',
                matchEquals: 'opened',
              },
            ],
            targetAction: ghPRAction.actionProperties.actionName,
            targetPipeline: reviewPipeline.pipelineName,
            targetPipelineVersion: 1,
            registerWithThirdParty: true,
          });
    }
}

module.exports = { ReviewAppsPipelineStack: ReviewAppsPipelineStack }
