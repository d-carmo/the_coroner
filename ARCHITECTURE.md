# Postmortem Generator Architecture

## Overview

This system generates structured incident postmortems in Notion from Slack incident channels.
A Slack slash command triggers an AWS Lambda function that fetches channel history, extracts transcription links, calls Claude AI, and creates a Notion page.

## Data Flow

```
Slack Incident Channel
  /generate-postmortem
        ↓
API Gateway
        ↓
AWS Lambda: postmortemHandler
        ↓
Slack API -> fetch channel messages
        ↓
Transcription extraction
        ↓
Claude API -> structured JSON
        ↓
Notion API -> create page
        ↓
Slack API -> send ephemeral reply
```

## Components

### Slack Slash Command

- Command: `/generate-postmortem`
- Must be invoked inside an incident channel
- Request URL: API Gateway endpoint
- Validated via Slack signature verification in `src/utils/slackVerification.ts`

### AWS API Gateway

- Exposes `POST /generate-postmortem`
- Routes requests to the Lambda function
- Current deployment uses Lambda-side Slack verification rather than API Gateway authorizers

### AWS Lambda Function

Defined in `template.yaml` as `PostmortemFunction`:

- Runtime: `nodejs20.x`
- Timeout: `60` seconds
- Memory: `1024` MB
- Handler: `dist/handlers/postmortemHandler.handler`

Lambda responsibilities:

1. Validate Slack signature and timestamp
2. Parse the incoming slash command payload
3. Fetch Slack channel messages via `conversations.history`
4. Extract transcription links from message text
5. Fetch transcript content when possible
6. Build a context payload for Claude
7. Call Claude and parse the JSON response
8. Create a Notion page under the configured parent page
9. Send an ephemeral Slack response to the user

### Claude Integration

- Endpoint: `https://api.anthropic.com/v1/messages`
- API key provided by `CLAUDE_API_KEY`
- `CLAUDE_MAX_TOKENS` controls the max tokens sent to Claude
- System prompt enforces a structured JSON postmortem format

### Notion Integration

- Uses the Notion Pages API
- Creates a page under the configured parent page ID
- Writes blocks for summary, timeline, findings, fixes, and action items

## Configuration

The SAM template references AWS Systems Manager Parameter Store parameters:

- `/notion-pm/slack-bot-token` (SecureString)
- `/notion-pm/slack-signing-secret` (SecureString)
- `/notion-pm/notion-api-key` (SecureString)
- `/notion-pm/notion-incidents-parent-id` (String)
- `/notion-pm/claude-api-key` (SecureString)
- `/notion-pm/claude-max-tokens` (String, optional)

The Lambda function uses `src/utils/ssmClient.ts` to retrieve these parameters securely at runtime.

## Notion Page Output

Each generated page is named with:

`YY_MM_DD-Incident-<affected-stack>`

And contains these sections:

- Summary
- Timeline
- Sequence of Events
- Discoveries & Actions
- Findings
- Fixes
- Action Items

## Security Notes

- Slack request signatures are verified using HMAC-SHA256
- Secrets are stored in AWS Systems Manager Parameter Store with encryption
- The Lambda function retrieves parameters securely at runtime using AWS SDK
- For production, consider using AWS Secrets Manager for more advanced secret management features

## Limitations

- Transcript extraction is URL-based and generic
- The implementation uses AWS Systems Manager Parameter Store for secret management
- API Gateway has no extra request authorization beyond Slack signature validation
- Production deployment should add stronger logging, monitoring, and rate limiting

## Deployment

The SAM template defines a single Lambda-backed API.
Deploy with:

```bash
npm run build
sam deploy --guided
```

Set the Lambda environment variables during deployment or replace the placeholders in `template.yaml`.

## Implementation details

- Handler: `src/handlers/postmortemHandler.ts`
- Service orchestration: `src/services/postmortemService.ts`
- Slack client: `src/clients/slackClient.ts`
- Claude client: `src/clients/claudeClient.ts`
- Notion client: `src/clients/notionClient.ts`
- Transcription extraction: `src/utils/extractTranscriptions.ts`
- Secret mapping: `src/utils/ssmClient.ts`

## Future enhancements

- Add direct Google Docs / Gemini transcript integration
- Add Fireflies or other transcript provider API support
- Add stronger API Gateway authorization
- Add transcript summarization before sending to Claude
