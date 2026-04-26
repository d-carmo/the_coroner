# the_coroner

> [!WARNING]
> This is a simple POC. The code hasn't been audited and there are no warranties it will be suitable for produciton environments.
> Actually... I do not recommend using it in production before securing it - by default there's no validation on the AWS Lambda endpoint, amongst other areas which require TLC (POC, remember?). 
> Even if it won't be a lot of work to do that, it is not done yet.

Automatically generate structured incident postmortems in Notion from Slack incident channels using Claude AI.

## Overview

`the_coroner` is a serverless pipeline that:

1. Receives a Slack slash command from an incident channel
2. Fetches Slack channel messages
3. Extracts transcription links from message text
4. Sends the combined context to Claude AI
5. Creates a structured Notion page with the generated postmortem
6. Replies to Slack with the Notion page URL

## What it does

- Slack `/generate-postmortem` slash command integration
- Slack message retrieval with pagination
- Transcription link extraction from channel text
- Claude AI postmortem generation
- Notion page creation with structured content
- Ephemeral Slack response with link to the generated page

## Architecture

```
Slack (/generate-postmortem)
      ↓
API Gateway
      ↓
AWS Lambda (src/handlers/postmortemHandler.ts)
      ↓
Slack API, Claude API, Notion API
      ↓
Notion page created, Slack ephemeral reply sent
```

## Requirements

- Node.js 18+
- AWS SAM CLI
- AWS CLI (recommended)
- Slack App with slash command
- Notion integration with page access
- Claude / Anthropic API key

## Setup

### 1. Clone and install

```bash
git clone <repository>
cd the_coroner
npm install
```

### 2. Configure AWS Systems Manager Parameters

Store these secrets in AWS Systems Manager Parameter Store:

| Parameter Name | Type | Description |
|----------------|------|-------------|
| `/notion-pm/slack-bot-token` | SecureString | Bot token from Slack App (`xoxb-...`) |
| `/notion-pm/slack-signing-secret` | SecureString | Signing secret from Slack App |
| `/notion-pm/notion-api-key` | SecureString | Notion integration secret |
| `/notion-pm/notion-incidents-parent-id` | String | Page ID of parent incidents page |
| `/notion-pm/claude-api-key` | SecureString | Anthropic API key (`sk-ant-...`) |
| `/notion-pm/claude-max-tokens` | String | Max tokens for Claude (optional, defaults to `4000`) |

Create parameters using AWS CLI:

```bash
aws ssm put-parameter --name "/notion-pm/slack-bot-token" --value "xoxb-your-token" --type "SecureString"
aws ssm put-parameter --name "/notion-pm/slack-signing-secret" --value "your-signing-secret" --type "SecureString"
aws ssm put-parameter --name "/notion-pm/notion-api-key" --value "secret-your-key" --type "SecureString"
aws ssm put-parameter --name "/notion-pm/notion-incidents-parent-id" --value "your-page-id" --type "String"
aws ssm put-parameter --name "/notion-pm/claude-api-key" --value "sk-ant-your-key" --type "SecureString"
aws ssm put-parameter --name "/notion-pm/claude-max-tokens" --value "4000" --type "String"
```

The SAM template automatically retrieves these parameters and makes them available to the Lambda function.

### 3. Build

```bash
npm run build
```

### 4. Deploy with SAM

```bash
sam deploy --guided
```

During deployment, the SAM template will:

- Create an IAM role for the Lambda function with SSM parameter read permissions
- Reference the SSM parameters you created in step 2
- Deploy the API Gateway and Lambda function

### 5. Configure Slack

1. Create a Slack App at https://api.slack.com/apps
2. Add a Slash Command:
   - Command: `/generate-postmortem`
   - Request URL: your API Gateway endpoint
3. Install the app into your workspace
4. Add the bot to the incident channel and use the slash command

### 6. Configure Notion

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Share the parent incidents page with the integration
3. Use the parent page ID for `NOTION_INCIDENTS_PARENT_ID`

## Environment variables

Use these exact names in your deployment or local environment:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `NOTION_API_KEY`
- `NOTION_INCIDENTS_PARENT_ID`
- `CLAUDE_API_KEY`
- `CLAUDE_MAX_TOKENS`

`CLAUDE_MAX_TOKENS` is optional and defaults to `4000`.

## Usage

1. Open the incident-only Slack channel
2. Ensure the bot is present in the channel
3. Run `/generate-postmortem`
4. The Lambda will process the channel and create a Notion page
5. A Slack ephemeral message returns the page URL

## Implementation details

Key source files:

- `src/handlers/postmortemHandler.ts` — receives Slack requests, verifies the signature, and triggers the service
- `src/services/postmortemService.ts` — orchestrates Slack fetch, transcription extraction, Claude call, and Notion page creation
- `src/clients/slackClient.ts` — Slack API integration
- `src/clients/claudeClient.ts` — Claude API integration
- `src/clients/notionClient.ts` — Notion API integration
- `src/utils/extractTranscriptions.ts` — transcription link extraction and fetch logic
- `src/utils/ssmClient.ts` — current environment variable mapping for secrets

Generated Notion pages follow this title pattern:

`YY_MM_DD-Incident-<affected-stack>`

## Local development

Build and test locally:

```bash
npm run build
npm test
npm run lint
```

## Notes and limitations

- The current implementation does not use an AWS Secrets Manager integration; it reads environment variables directly.
- Transcription extraction is based on URL patterns and generic HTML text extraction.
- The Lambda runtime is Node.js 20 with 1024 MB memory and a 60-second timeout.
- Production deployments should harden the API endpoint and secure environment variable handling.

## License

MIT
