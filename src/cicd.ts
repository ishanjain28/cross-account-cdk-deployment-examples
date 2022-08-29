import { SecretValue, Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib';
import { EventAction, FilterGroup } from 'aws-cdk-lib/aws-codebuild';
import { Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { GitHubTrigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  CodePipeline,
  CodePipelineSource,
  ManualApprovalStep,
  ShellStep,
} from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BaseInfraConfig, RepoEntry } from './config';
import { InfraStack } from './infra-stack';
import { PipelineStack } from './pipeline-stack';
import { SharedStack } from './shared-stack';
import { WebhookFilteredPipeline } from './webhook-filtered-pipeline';

interface EnvironmentStageProps extends StageProps {
  readonly config: BaseInfraConfig;
  readonly repo: RepoEntry;
  readonly codestarConnectionArn: string;
  readonly envName: string;
}

export class EnvironmentStage extends Stage {
  constructor(scope: Construct, id: string, props: EnvironmentStageProps) {
    super(scope, id, props);

    // SharedStack should be used to create stuff which will  be used by both stacks to avoid any circular dependencies issues
    const sharedStack = new SharedStack(this, 'SharedStack', {
      stage: id,
    });

    // Deploy the infra we'll use to serve content
    const infraStack = new InfraStack(this, 'InfraStack', {
      stage: id,
      config: props.config,
      webappBucket: sharedStack.deploymentBucket,
    });
    infraStack.addDependency(sharedStack);

    // Deploy the pipeline which will monitor the project repos, build them when there is a change
    // and deploy them to the infrastructure.
    // Currently, This project is configured to build a repo and put the built artifact in a s3 bucket
    // and then something in AppStack should serve those built artifacts
    const pipelineStack = new PipelineStack(this, 'PipelineStack', {
      codestarConnectionArn: props.codestarConnectionArn,
      repo: props.repo,
      envName: props.envName,
      webappBucket: sharedStack.deploymentBucket,
    });

    pipelineStack.addDependency(infraStack);
    pipelineStack.addDependency(sharedStack);
  }
}

interface CICDStackProps extends StackProps {
  readonly repo: RepoEntry;

  readonly githubTokenArn: string;
  readonly dev: BaseInfraConfig;
  readonly staging: BaseInfraConfig;
  readonly production: BaseInfraConfig;
}

export class CICDStack extends Stack {
  constructor(scope: Construct, id: string, props: CICDStackProps) {
    super(scope, id, props);

    const sourceArtifact = new Artifact();
    const oauthToken = SecretValue.secretsManager(props.githubTokenArn);

    // WebhookFilteredPipeline should be used if your project is in a monorepo and you want to triggger
    // the cicd pipeline when some files in the project are modified instead of running it on every commit.
    // But because of the way this module is written(uses codebuild and it's native github v1 integration), It's terrible, terrible way to do this for several reasons.
    // You should replace this completely with a lambda which'll manage everything instead of relying on codebuild's github integration.
    const webhookPipeline = new WebhookFilteredPipeline(
      this,
      'CICDWebhookPipeline',
      {
        githubSourceActionProps: {
          ...props.repo,
          actionName: 'Pull_Source_Code',
          output: sourceArtifact,
          trigger: GitHubTrigger.WEBHOOK,
          oauthToken: oauthToken,
        },
        restartExecutionOnUpdate: true,
        webhookFilters: [
          FilterGroup.inEventOf(EventAction.PUSH)
            .andBranchIs(props.repo.branch)
            .andFilePathIs(props.repo.path),
        ],
      },
    );

    const pipeline = new CodePipeline(this, 'CICDPipeline', {
      codePipeline: webhookPipeline,
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.gitHub(
          `${props.repo.owner}/${props.repo.repo}`,
          props.repo.branch,
          {
            authentication: oauthToken,
            trigger: GitHubTrigger.NONE,
          },
        ),
        commands: [
          `cd ./${props.repo.path}`,
          'yarn install --immutable --immutable-cache --check-cache',
          'npm run build',
          'npx cdk synth',
        ],
        primaryOutputDirectory: `./${props.repo.path}/cdk.out`,
      }),
    });

    pipeline.addStage(
      new EnvironmentStage(this, 'Dev', {
        env: props.dev.env,
        repo: props.dev.repo,
        config: {
          ...props.dev,
        },
        codestarConnectionArn: props.dev.codestarConnectionArn,
        envName: 'dev',
      }),
    );

    pipeline.addStage(
      new EnvironmentStage(this, 'Staging', {
        env: props.staging.env,
        repo: props.staging.repo,
        config: {
          ...props.staging,
        },
        codestarConnectionArn: props.staging.codestarConnectionArn,
        envName: 'staging',
      }),
      {
        pre: [new ManualApprovalStep('Approve deployment to Staging Account')],
      },
    );

    pipeline.addStage(
      new EnvironmentStage(this, 'Prod', {
        env: props.production.env,
        repo: props.production.repo,
        config: {
          ...props.production,
        },
        codestarConnectionArn: props.production.codestarConnectionArn,
        envName: 'production',
      }),
      {
        pre: [
          new ManualApprovalStep('Approve deployment to Production Account'),
        ],
      },
    );
  }
}
