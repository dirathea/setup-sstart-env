# setup-sstart GitHub Action

A GitHub Action to use [sstart](https://github.com/dirathea/sstart) in your GitHub workflows. This action simplifies loading secrets from external sources into your GitHub Actions workflows.

## What is sstart?

sstart is a tool for managing and fetching secrets from external sources (like cloud secret managers, APIs, etc.). This action integrates sstart into your GitHub Actions workflows, allowing you to securely fetch external secrets and make them available as environment variables in your workflow steps.

## Usage

```yaml
name: Setup and Run sstart
on: [push, pull_request]

jobs:
  setup-sstart:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Fetch external secrets with sstart
        uses: dirathea/sstart-github-action@v1
        with:
          config: |
            providers:
              - kind: aws_secretsmanager
                secret_id: myapp/production
                keys:
                  DATABASE_URL: ==
                  API_KEY: ==
      
      - name: Use fetched environment variables
        run: |
          echo "Using secret: $MY_SECRET"
          echo "Using config: $MY_CONFIG"
          # Environment variables from sstart env are now available
```

## Inputs

### `config` (required)

YAML configuration for sstart, resembling `.sstart.yml` format. This configuration tells sstart where and how to fetch your external secrets. The config will be written to `.sstart.yml` in the workspace before running sstart.

The format should match what you would normally put in a `.sstart.yml` file. Refer to the [sstart documentation](https://github.com/dirathea/sstart) for the exact configuration format.

### `version` (optional)

Version of sstart to download. Defaults to `0.0.2`. Downloads from `https://github.com/dirathea/sstart/releases/download/v{version}/sstart-{platform}`. You can specify the version with or without the 'v' prefix (e.g., `0.0.2` or `v0.0.2`).

## Environment Variables

sstart requires authentication credentials to connect to external secret providers. You must provide these credentials as environment variables using the `env:` key at the step level. These environment variables will be available to the sstart binary when it executes.

**Note:** Secret values are automatically masked in GitHub Actions logs for security.

Different secret providers require different environment variables for authentication. For complete authentication requirements and configuration details for each provider, refer to the [sstart configuration documentation](https://github.com/dirathea/sstart/blob/main/CONFIGURATION.md).

## Examples

### Basic usage with default version

```yaml
- name: Fetch external secrets with sstart
  uses: dirathea/sstart-github-action@v1
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: us-east-1
  with:
    config: |
      providers:
        - kind: aws_secretsmanager
          secret_id: myapp/production

- name: Use the fetched secrets
  run: |
    echo "Database URL: $DATABASE_URL"
    echo "API Key: $API_KEY"
```

### Using specific version

```yaml
- name: Fetch external secrets with sstart
  uses: dirathea/sstart-github-action@v1
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
  with:
    version: "0.0.1"
    config: |
      providers:
        - kind: 1password
          ref: op://Production/MyApp/API_KEY
```

### Using authentication credentials

sstart needs credentials to authenticate with your secret provider. Pass these credentials as environment variables:

```yaml
- name: Fetch external secrets with sstart
  uses: dirathea/sstart-github-action@v1
  env:
    # AWS credentials for AWS Secrets Manager
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: us-east-1
  with:
    config: |
      providers:
        - kind: aws_secretsmanager
          secret_id: myapp/production

- name: Deploy using fetched secrets
  run: |
    # All secrets fetched by sstart are now available
    echo "Database URL: $DATABASE_URL"
    echo "API Key: $API_KEY"
    docker build -t myapp .
    docker push myapp
```

**Example with 1Password:**
```yaml
- name: Fetch external secrets with sstart
  uses: dirathea/sstart-github-action@v1
  env:
    # 1Password service account token
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
  with:
    config: |
      providers:
        - kind: 1password
          ref: op://Production/MyApp/Database
```

## How it works

This action simplifies using sstart to load secrets for your GitHub workflows. Under the hood, it downloads the sstart binary, writes your configuration to `.sstart.yml`, and runs `sstart env` to fetch secrets from your configured providers. The output from `sstart env` is then automatically set as GitHub Actions environment variables, making them available to all subsequent steps in your workflow.

You can access the loaded secrets using `${{ env.VARIABLE_NAME }}` or `$VARIABLE_NAME` in shell commands.

## License

ISC

