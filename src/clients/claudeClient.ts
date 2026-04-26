import { IncidentContext, IncidentPostmortem } from '../types';
import { getParam } from '../utils/ssmClient';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_CLAUDE_MAX_TOKENS = 4000;

let claudeApiKey: string | null = null;

async function getClaudeApiKey(): Promise<string> {
  if (!claudeApiKey) {
    claudeApiKey = await getParam('/notion-pm/claude-api-key');
  }
  return claudeApiKey;
}

const SYSTEM_PROMPT = `You are an expert incident postmortem analyst. Your task is to analyze Slack channel discussions and video call transcriptions to generate a comprehensive, structured postmortem document.

You will receive:
1. Channel name and metadata
2. All Slack messages from the incident channel
3. Any transcription links from video calls

Generate a JSON response with exactly this structure:
{
  "summary": "Brief 2-3 sentence overview of what happened",
  "affectedStack": "The main system/service affected (e.g., 'payments-service', 'auth-service', 'database-replication')",
  "timeline": [
    {
      "time": "HH:MM UTC",
      "event": "Description of what happened at this time"
    }
  ],
  "sequenceOfEvents": "Detailed narrative of the incident progression",
  "discoveriesAndActions": [
    {
      "discovery": "What was discovered",
      "action": "What action was taken"
    }
  ],
  "findings": [
    "Root cause analysis",
    "Contributing factors"
  ],
  "fixes": [
    "Implemented solutions"
  ],
  "actionItems": [
    {
      "task": "Description of follow-up task",
      "assignee": "Optional: specific team member or role",
      "dueDate": "Optional: suggested due date"
    }
  ]
}

Guidelines:
- Be concise but comprehensive
- Extract dates from the content for timeline
- Identify the affected system/service from context
- List only actionable follow-ups as action items
- If no information is available for a section, use an empty array or placeholder
`;

function getClaudeMaxTokens(): number {
  const parsed = Number(process.env.CLAUDE_MAX_TOKENS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_CLAUDE_MAX_TOKENS;
}

export async function generatePostmortem(
  context: IncidentContext
): Promise<IncidentPostmortem> {
  const content = buildPromptContent(context);
  const apiKey = await getClaudeApiKey();

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: getClaudeMaxTokens(),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { content?: Array<{ text: string }> };
  const responseText = data.content?.[0]?.text;

  if (!responseText) {
    throw new Error('Claude returned empty response');
  }

  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || ['', responseText];
    return JSON.parse(jsonMatch[1] || responseText);
  } catch {
    throw new Error('Failed to parse Claude response as JSON');
  }
}

function buildPromptContent(context: IncidentContext): string {
  const messageSummary = context.messages
    .slice(0, 100)
    .map((m) => `[${m.ts}] ${m.user}: ${m.text}`)
    .join('\n');

  const transcriptionSummary = context.transcriptions
    .map((t) => `[${t.provider}] ${t.url}\n${t.content}`)
    .join('\n\n--- TRANSCRIPT ---\n\n');

  return `Channel: ${context.channelName}
Start Time: ${context.startTime}
End Time: ${context.endTime}

Slack Messages:
${messageSummary}

Video Transcription Links:
${transcriptionSummary || 'No transcription links found'}
`;
}