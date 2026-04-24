# Postmortem Generator Architecture

## Overview

This system automatically generates structured postmortem documents in Notion from Slack incident channels. When invoked via a Slack slash command in an incident channel, it gathers all channel discussions and linked video call transcriptions, processes them through Claude AI, and creates a formatted Notion page.

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SLACK WORKSPACE                                 │
│  /generate-postmortem                                                         │
│  (Slash command invoked in incident channel)                                  │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          AWS API GATEWAY                                     │
│  POST /generate-postmortem                                                    │
│  Request body: { channel_id, slack_token, user_id }                          │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          AWS LAMBDA                                          │
│                                                                               │
│  Step 1: Fetch channel messages via Slack API                                │
│  Step 2: Extract video call transcription links (Zoom, Google Meet, etc.)    │
│  Step 3: Build unified context payload                                      │
│  Step 4: Call Claude API → structured incident JSON                         │
│  Step 5: Create Notion page under "incidents" parent                        │
│  Step 6: Send Notion page URL to Slack as ephemeral message                  │
│                                                                               │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          NOTION                                              │
│  Parent: Incidents page/database                                             │
│  Child page: YY_MM_DD-Incident-<affected-stack>                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Slack Slash Command

- **Command**: `/generate-postmortem`
- **Scope**: Must be invoked within an incident channel
- **Behavior**: Triggers immediately upon invocation; Lambda handles async processing
- **Response**: Ephemeral Slack message containing the Notion page link

### 2. AWS API Gateway

- **Endpoint**: `POST /generate-postmortem`
- **Auth**: Slack request signature verification
- **Rate limiting**: Per-user, per-channel limits to prevent spam

### 3. AWS Lambda Function

The Lambda orchestrates the entire pipeline:

#### Step 1: Fetch Slack Messages
```
- conversations.history API
- Include threaded replies
- Date range: entire channel history (or configurable lookback)
- Capture: text, timestamps, users, reactions, thread replies
```

#### Step 2: Extract Transcription Links
```
- Parse message content for known video call domains:
  - Zoom
  - Google Meet
  - Loom
  - Otter.ai
  - Other configurable providers
- Fetch transcription content if accessible
```

#### Step 3: Build Context Payload
```
{
  "channel_name": "inc-2024-04-15-payment-outage",
  "messages": [...],
  "transcriptions": [...],
  "start_time": "ISO-8601",
  "end_time": "ISO-8601"
}
```

#### Step 4: Claude API Integration
```
- Model: Claude ( Opus or Sonnet )
- System prompt: Structured postmortem generation instructions
- Output format: JSON with defined schema
```

#### Step 5: Notion Page Creation
```
- Parent: Pre-configured "incidents" page/database
- Page title: YY_MM_DD-Incident-<affected-stack>
- Content: Structured blocks based on Claude output
```

#### Step 6: Slack Notification
```
- Ephemeral message (visible only to invoking user)
- Contains Notion page URL
- Includes brief summary of what was generated
```

## Notion Page Structure

Generated pages follow this schema:

```
YY_MM_DD-Incident-<affected-stack>
│
├── Summary
│   └── Brief description of the incident
│
├── Timeline
│   └── Chronological sequence of events
│
├── Sequence of Events
│   └── Detailed step-by-step progression
│
├── Discoveries & Actions
│   └── Key findings and immediate responses
│
├── Findings
│   └── Root cause analysis and contributing factors
│
├── Fixes
│   └── Implemented solutions and workarounds
│
└── Action Items
    └── Follow-up tasks with assignees
```

## Page Naming Convention

Format: `YY_MM_DD-Incident-<affected-stack>`

Examples:
- `24_04_15-Incident-payments-service`
- `24_03_22-Incident-authentication`
- `24_05_01-Incident-database-replication`

Where `<affected-stack>` is determined from the incident context (Claude extracts this from the Slack discussions).

## Technology Stack

| Component | Technology |
|-----------|------------|
| Slack Integration | Slack API + Slash Commands |
| API Layer | AWS API Gateway |
| Compute | AWS Lambda (Node.js or Python) |
| AI Processing | Claude API (Anthropic) |
| Documentation | Notion API |
| Infrastructure | AWS (SAM or CDK) |

## Security Considerations

1. **Slack Verification**: Validate request signatures from Slack
2. **Secret Management**: Store tokens (Slack, Notion, Claude) in AWS Secrets Manager or Parameter Store
3. **IAM Roles**: Lambda uses minimal required permissions
4. **Network**: Optionally use VPC for Notion API calls

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid Slack signature | Return 401, no processing |
| Channel not found | Return 404 with message |
| No messages found | Return 400 with helpful error |
| Claude API failure | Retry with backoff, then return 500 |
| Notion API failure | Retry with backoff, then return 500 |
| Partial failure | Log state, return 500 with error details |

## Environment Variables

```
SLACK_BOT_TOKEN=<xoxb-...>
SLACK_SIGNING_SECRET=<signing secret>
NOTION_API_KEY=<secret-...>
NOTION_INCIDENTS_PARENT_ID=<page ID>
CLAUDE_API_KEY=<sk-ant-...>
AWS_LAMBDA_FUNCTION_NAME=<function name>
```

## Future Enhancements

