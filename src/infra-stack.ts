import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { BaseInfraConfig } from './config';

interface InfraStackProps extends StackProps {
  readonly stage: string;
  readonly webappBucket: IBucket;
  readonly config: BaseInfraConfig;
}

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    Tags.of(this).add('ServiceName', this.node.tryGetContext('service_name'));

    // TODO: Add a cloudfront or something else to serve the contents of s3 bucket
  }
}
