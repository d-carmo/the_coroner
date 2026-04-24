export interface SlackMessage {
  type: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; users: string[] }>;
  blocks?: unknown[];
}

export interface SlackConversationHistoryResponse {
  ok: boolean;
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface Transcription {
  url: string;
  provider: string;
  content?: string;
}

export interface IncidentContext {
  channelName: string;
  channelId: string;
  messages: SlackMessage[];
  transcriptions: Transcription[];
  startTime: string;
  endTime: string;
}

export interface IncidentPostmortem {
  summary: string;
  affectedStack: string;
  timeline: Array<{
    time: string;
    event: string;
  }>;
  sequenceOfEvents: string;
  discoveriesAndActions: Array<{
    discovery: string;
    action: string;
  }>;
  findings: string[];
  fixes: string[];
  actionItems: Array<{
    task: string;
    assignee?: string;
    dueDate?: string;
  }>;
}

export interface NotionPageContent {
  title: string;
  blocks: NotionBlock[];
}

export interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackSlashCommandPayload {
  channel_id: string;
  channel_name: string;
  user_id: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

export interface LambdaEvent {
  body: string;
  headers: Record<string, string>;
}