import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface SharedStackProps extends StackProps {
  readonly stage: string;
}

export class SharedStack extends Stack {
  deploymentBucket: IBucket;

  constructor(scope: Construct, id: string, props: SharedStackProps) {
    super(scope, id, props);

    Tags.of(this).add('ServiceName', this.node.tryGetContext('service_name'));

    this.deploymentBucket = new Bucket(this, 'DeploymentBucket', {
      websiteIndexDocument: 'index.html',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
