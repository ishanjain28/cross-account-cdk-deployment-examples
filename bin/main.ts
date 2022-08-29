import { App } from 'aws-cdk-lib'
import { CICDStack } from '../src/cicd'
import { Config } from '../src/config'

const config = new Config('config.yml')
const app = new App()

new CICDStack(app, 'CICDStack', {
  repo: config.devops.repo,
  env: config.devops.env,
  dev: config.dev,
  production: config.production,
  staging: config.staging,
  githubTokenArn: config.devops.githubTokenArn,
})
