import * as fs from 'fs';
import * as YAML from 'yaml';

export interface RepoEntry {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  readonly path: string;
}

export interface Env {
  readonly account: string;
  readonly region: string;
}

export interface BaseAppConfig {
  readonly env: Env;
  readonly repo: RepoEntry;
}

export interface DevopsStackConfig extends BaseAppConfig {
  readonly githubTokenArn: string;
}

export interface BaseInfraConfig extends BaseAppConfig {
  readonly codestarConnectionArn: string;
}

export class Config {
  readonly devops: DevopsStackConfig;
  readonly dev: BaseInfraConfig;
  readonly staging: BaseInfraConfig;
  readonly production: BaseInfraConfig;

  constructor(fileName?: string) {
    const filename = fileName || 'config.yml';
    const file = fs.readFileSync(filename, 'utf-8');

    const yaml = YAML.parse(file);

    this.dev = yaml.dev;
    this.staging = yaml.staging;
    this.production = yaml.production;
    this.devops = yaml.devops;

    console.log(this);
  }
}
