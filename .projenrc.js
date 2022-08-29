const { AwsCdkTypeScriptApp } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '2.4.0',
  defaultReleaseBranch: 'main',
  name: 'cross-account-cdk-deployment-examples',
  authorName: 'ishan jain',
  repository: 'https://github.com/ishanjain28/cross-account-cdk-deployment-examples',
  // Assuming we are putting built artifacts in `./dist` directory
  gitignore: ['*/dist/*'],
  bin: {
    shared: 'bin/main.ts',
  },
  tsconfig: {
    compilerOptions: {
      resolveJsonModule: true,
    },
  },
  licensed: false,
  cdkDependencies: [],
  deps: ['yaml'],
  devDeps: ['cdk-dia'],
  dependabot: false,
  buildWorkflow: false,
  releaseWorkflow: false,
  jest: false,
  github: false,
  context: {
    service_name: 'cross-account-cdk-deployment-examples',
  },
});

project.addTask('gen-dia', {
  cwd: './docs',
  exec: 'npx cdk-dia --tree ../cdk.out/tree.json',
});

project.cdkConfig.app = 'npx ts-node --prefer-ts-exts bin/main.ts';

project.synth();
