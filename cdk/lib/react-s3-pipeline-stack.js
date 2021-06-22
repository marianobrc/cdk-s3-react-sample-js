const cdk = require('@aws-cdk/core');
const { App, Stack, StackProps, SecretValue } = require('@aws-cdk/core');
const codebuild = require('@aws-cdk/aws-codebuild');
const codepipeline = require('@aws-cdk/aws-codepipeline');
const codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
const ssm = require("@aws-cdk/aws-ssm");
const iam = require("@aws-cdk/aws-iam");
const { CdkStack } = require('./react-js-app-stack');


class ReactS3PipelineStack extends Stack{
    constructor(app, id, props) {
        super(app, id, props);
        const webapp = props.webapp;
        const sourceOutput = new codepipeline.Artifact();
        const buildOutput = new codepipeline.Artifact();

        // Parameters to get the source code from GH
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

        // Create the build project that will invalidate the CloudFront cache
        const invalidateBuildProject = new codebuild.PipelineProject(this, `InvalidateProject`, {
            buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
                build: {
                commands:[
                    'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
                    // Choose whatever files or paths you'd like, or all files as specified here
                ],
                },
            },
            }),
            environmentVariables: {
            CLOUDFRONT_ID: { value: webapp.cloudfrontDistro.distributionId },
            },
        });
        
        // Add Cloudfront invalidation permissions to the project
        const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${webapp.cloudfrontDistro.distributionId}`;
        invalidateBuildProject.addToRolePolicy(new iam.PolicyStatement({
            resources: [distributionArn],
            actions: [
            'cloudfront:CreateInvalidation',
            ],
        }));
  

        // The pipeline
        new codepipeline.Pipeline(this, 'Pipeline', {
            restartExecutionOnUpdate: true,
            stages: [
              {
                stageName: 'Source',
                actions: [
                    new codepipeline_actions.GitHubSourceAction({
                        actionName: 'Github_Source',
                        owner: owner,
                        repo: repo,
                        oauthToken: secret,
                        output: sourceOutput,
                    }),
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
                        bucket: webapp.bucket,
                        runOrder: 1,
                    }),
                    new codepipeline_actions.CodeBuildAction({
                        actionName: 'Invalidate_Cache',
                        project: invalidateBuildProject,
                        input: buildOutput,
                        runOrder: 2,
                    }),
                ],
              }
            ],
          });
    }
}

module.exports = { PipelineStack: ReactS3PipelineStack }
