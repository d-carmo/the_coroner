import { SlackMessage } from '../types';
import { getParam } from '../utils/ssmClient';

let slackBotToken: string | null = null;

async function getSlackBotToken(): Promise<string> {
  if (!slackBotToken) {
    slackBotToken = await getParam('/notion-pm/slack-bot-token');
  }
  return slackBotToken;
}

interface SlackApiResponse {
  ok: boolean;
  messages?: SlackMessage[];
  response_metadata?: {
    next_cursor?: string;
  };
}

export async function fetchChannelMessages(
  channelId: string,
  cursor?: string
): Promise<{ messages: SlackMessage[]; nextCursor?: string }> {
  console.log('fetchChannelMessages called for:', channelId);
  const url = 'https://slack.com/api/conversations.history';
  const params = new URLSearchParams({
    channel: channelId,
    limit: '200',
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const token = await getSlackBotToken();
  
  let response;
  for (let i = 0; i < 5; i++) {
    try {
      console.log('Attempt', i + 1, 'fetching', url);
      
      response = await fetch(`${url}?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Response status:', response.status);
      break;
    } catch (err: any) {
      console.log('Fetch attempt', i + 1, 'failed:', err.name, err.message);
      if (i === 4) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }

  if (!response) throw new Error('No response from Slack');

  const data = (await response.json()) as SlackApiResponse;

  if (!data.ok) {
    throw new Error(`Slack API error: ${JSON.stringify(data)}`);
  }

  return {
    messages: data.messages || [],
    nextCursor: data.response_metadata?.next_cursor,
  };
}

export async function fetchAllMessages(channelId: string): Promise<SlackMessage[]> {
  const allMessages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const { messages, nextCursor } = await fetchChannelMessages(channelId, cursor);
    allMessages.push(...messages);
    cursor = nextCursor;

    if (!nextCursor) break;
  } while (allMessages.length < 1000);

  return allMessages;
}

export async function postEphemeralMessage(
  channelId: string,
  userId: string,
  text: string
): Promise<void> {
  const token = await getSlackBotToken();
  const response = await fetch('https://slack.com/api/chat.postEphemeral', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      user: userId,
      text,
    }),
  });

  const data = (await response.json()) as { ok: boolean };
  if (!data.ok) {
    throw new Error(`Failed to post ephemeral message: ${JSON.stringify(data)}`);
  }
}

export async function postResponseUrl(
  responseUrl: string,
  text: string
): Promise<void> {
  const response = await fetch(responseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      response_type: 'ephemeral',
      text,
    }),
  });

  const data = (await response.json()) as { ok: boolean };
  if (!data.ok) {
    throw new Error(`Failed to post delayed response: ${JSON.stringify(data)}`);
  }
}
