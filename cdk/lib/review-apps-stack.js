const cdk = require('@aws-cdk/core');
const s3 = require('@aws-cdk/aws-s3');
const s3Deploy = require('@aws-cdk/aws-s3-deployment');
const cloudfront = require('@aws-cdk/aws-cloudfront');


class ReviewAppsStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // S3
    this.bucket = new s3.Bucket(this, "ReviewAppsBucket", {
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

  }
}
module.exports = { ReviewAppsStack: ReviewAppsStack }
