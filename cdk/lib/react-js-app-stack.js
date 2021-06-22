const cdk = require('@aws-cdk/core');
const s3 = require('@aws-cdk/aws-s3');
const s3Deploy = require('@aws-cdk/aws-s3-deployment');
const cloudfront = require('@aws-cdk/aws-cloudfront');


class ReactJsAppStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // S3
    this.bucket = new s3.Bucket(this, "SampleReactJSAppBucket", {
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      websiteIndexDocument: "index.html"
    });

    // Enable CORS for any origin
    const cfnBucket = this.bucket.node.findChild("Resource");
    cfnBucket.addPropertyOverride("CorsConfiguration", {
      CorsRules: [
        {
          AllowedOrigins: ["*"],
          AllowedMethods: ["HEAD", "GET"],  // read only
          ExposedHeaders: [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
          ],
          AllowedHeaders: ["*"]
        }
      ]
    });

    // Deployment
    const src = new s3Deploy.BucketDeployment(this, "DeploySampleReactJSApp", {
      sources: [s3Deploy.Source.asset("../build")],
      destinationBucket: this.bucket
    });

    // Cloudfront
    this.cloudfrontDistro = new cloudfront.CloudFrontWebDistribution(this, "SampleReactJSAppCloudfrontDistribution", {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: this.bucket
          },
          behaviors: [{isDefaultBehavior: true}]
        },
      ]
    });
  }
}

module.exports = { CdkStack: ReactJsAppStack }
