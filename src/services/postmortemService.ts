import { IncidentContext, IncidentPostmortem } from '../types';
import { fetchAllMessages } from '../clients/slackClient';
import { generatePostmortem } from '../clients/claudeClient';
import { createPostmortemPage } from '../clients/notionClient';
import { extractTranscriptionLinks, fetchAllTranscriptions } from '../utils/extractTranscriptions';
import { formatDate } from '../utils/helpers';

export async function createIncidentPostmortem(
  channelId: string,
  channelName: string
): Promise<{ pageUrl: string; pageTitle: string }> {
  console.log('Fetching messages for channel:', channelId);
  const messages = await fetchAllMessages(channelId);
  console.log('Got messages:', messages.length);

  if (messages.length === 0) {
    throw new Error('No messages found in the channel');
  }

  console.log('Extracting transcription links...');
  const transcriptions = extractTranscriptionLinksFromMessages(messages);
  console.log('Found transcription links:', transcriptions.length);
  
  const transcriptionsWithContent = await fetchAllTranscriptions(transcriptions);
  console.log('Transcriptions with content:', transcriptionsWithContent.length);

  const timestamps = messages.map((m) => parseFloat(m.ts));
  const startTime = new Date(Math.min(...timestamps) * 1000).toISOString();
  const endTime = new Date(Math.max(...timestamps) * 1000).toISOString();

  console.log('Building context and calling Claude...');
  const context: IncidentContext = {
    channelName,
    channelId,
    messages,
    transcriptions: transcriptionsWithContent,
    startTime,
    endTime,
  };

  const postmortem = await generatePostmortem(context);
  console.log('Claude response received');

  const pageTitle = buildPageTitle(postmortem);
  console.log('Creating Notion page:', pageTitle);
  const pageUrl = await createPostmortemPage(pageTitle, postmortem);

  return { pageUrl, pageTitle };
}

function extractTranscriptionLinksFromMessages(
  messages: { text: string }[]
): { url: string; provider: string }[] {
  const links: { url: string; provider: string }[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    const extracted = extractTranscriptionLinks(message.text);
    for (const link of extracted) {
      if (!seen.has(link.url)) {
        seen.add(link.url);
        links.push(link);
      }
    }
  }

  return links;
}

function buildPageTitle(postmortem: IncidentPostmortem): string {
  const dateStr = formatDate();
  return `${dateStr}-Incident-${postmortem.affectedStack}`;
}