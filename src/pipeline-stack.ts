import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import {
  BuildSpec,
  ComputeType,
  LinuxBuildImage,
  PipelineProject,
} from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  CodeBuildAction,
  ManualApprovalAction,
  S3DeployAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { RepoEntry } from './config';

interface PipelineStackProps extends StackProps {
  readonly repo: RepoEntry;
  readonly codestarConnectionArn: string;
  readonly envName: string;
  webappBucket: IBucket;
}

export class PipelineStack extends Stack {
  props: PipelineStackProps;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    this.props = props;

    Tags.of(this).add('ServiceName', this.node.tryGetContext('service_name'));

    this.createPipeline(props.envName);
  }

  createPipeline(distName: string) {
    const srcArtifact = new Artifact();

    const pullSourceCodeAction = new codepipeline_actions.CodeStarConnectionsSourceAction(
      {
        actionName: 'Pull_Project',
        connectionArn: this.props.codestarConnectionArn,
        output: srcArtifact,
        owner: this.props.repo.owner,
        repo: this.props.repo.repo,
        branch: this.props.repo.branch,
      },
    );

    let pipeline = new Pipeline(this, `BuildPublishPipeline${distName}`, {
      pipelineName: `project-${distName}`,
      stages: [
        {
          stageName: 'Pull_Source_Code',
          actions: [pullSourceCodeAction],
        },
      ],
    });

    const webBuildOutput = new Artifact();
    const projectBuildAction = new CodeBuildAction({
      actionName: `BuildProject${distName}`,
      input: srcArtifact,
      outputs: [webBuildOutput],
      runOrder: 1,
      project: new PipelineProject(this, `PipelineProject${distName}`, {
        environment: {
          computeType: ComputeType.SMALL,
          buildImage: LinuxBuildImage.STANDARD_5_0,
        },
        buildSpec: BuildSpec.fromObject({
          version: 0.2,
          phases: {
            install: {
              'runtime-versions': {
                // TODO: Change runtime?
                nodejs: 14,
              },
              'commands': [
                // TODO: Add commands to install dependencies before building the project
                'echo',
              ],
            },
            build: {
              commands: [
                // TODO: Add commands to build the project
                'echo',
              ],
            },
          },
          artifacts: {
            'files': ['**/**'],
            // TODO: Change this directory to where built artifacts are placed
            'base-directory': 'dist/',
          },
        }),
      }),
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [projectBuildAction],
    });

    // Deploy directly to dev buckets but ask for approval when deploying to staging/prod buckets
    if (this.props.envName !== 'dev') {
      pipeline.addStage({
        stageName: 'ApproveDeploymentToS3',
        actions: [
          new ManualApprovalAction({
            actionName: 'ApproveDeployment',
            // TODO: Add a link to the instance/service which'll serve contents of this bucket
            externalEntityLink: 'https://google.com',
          }),
        ],
      });
    }

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new S3DeployAction({
          actionName: 'DeployToS3',
          bucket: this.props.webappBucket,
          // TODO: Currently, this'll put built artifacts in root.
          // Change this if you want to push artifacts to some other directory
          objectKey: '/',
          input: webBuildOutput,
          extract: true,
          runOrder: 1,
        }),
      ],
    });
  }
}
