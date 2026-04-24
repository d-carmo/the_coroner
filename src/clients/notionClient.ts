import { IncidentPostmortem, NotionBlock } from '../types';
import { getParam } from '../utils/ssmClient';

let notionApiKey: string | null = null;
let notionIncidentsParentId: string | null = null;

async function getNotionApiKey(): Promise<string> {
  if (!notionApiKey) {
    notionApiKey = await getParam('/notion-pm/notion-api-key');
  }
  return notionApiKey;
}

async function getNotionIncidentsParentId(): Promise<string> {
  if (!notionIncidentsParentId) {
    notionIncidentsParentId = await getParam('/notion-pm/notion-incidents-parent-id');
  }
  return notionIncidentsParentId;
}

const NOTION_API_URL = 'https://api.notion.com/v1';

export async function createPostmortemPage(
  title: string,
  postmortem: IncidentPostmortem
): Promise<string> {
  const blocks = buildNotionBlocks(postmortem);
  const apiKey = await getNotionApiKey();
  const parentId = await getNotionIncidentsParentId();

  const response = await fetch(`${NOTION_API_URL}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { page_id: parentId },
      icon: {
        type: 'emoji',
        emoji: '📋',
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      children: blocks,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

function buildNotionBlocks(postmortem: IncidentPostmortem): NotionBlock[] {
  const blocks: NotionBlock[] = [];

  blocks.push(createHeading('Summary', 1));
  blocks.push(createParagraph(postmortem.summary));

  blocks.push(createHeading('Timeline', 1));
  if (postmortem.timeline.length > 0) {
    for (const item of postmortem.timeline) {
      blocks.push(
        createParagraph(`**${item.time}** - ${item.event}`)
      );
    }
  } else {
    blocks.push(createParagraph('No timeline data available.'));
  }

  blocks.push(createHeading('Sequence of Events', 1));
  blocks.push(createParagraph(postmortem.sequenceOfEvents));

  blocks.push(createHeading('Discoveries & Actions', 1));
  if (postmortem.discoveriesAndActions.length > 0) {
    for (const item of postmortem.discoveriesAndActions) {
      blocks.push(createBulletedListItem(`**Discovery:** ${item.discovery}`));
      blocks.push(createBulletedListItem(`**Action:** ${item.action}`));
      blocks.push(createDivider());
    }
  } else {
    blocks.push(createParagraph('No discoveries or actions recorded.'));
  }

  blocks.push(createHeading('Findings', 1));
  if (postmortem.findings.length > 0) {
    for (const finding of postmortem.findings) {
      blocks.push(createBulletedListItem(finding));
    }
  } else {
    blocks.push(createParagraph('No findings recorded.'));
  }

  blocks.push(createHeading('Fixes', 1));
  if (postmortem.fixes.length > 0) {
    for (const fix of postmortem.fixes) {
      blocks.push(createBulletedListItem(fix));
    }
  } else {
    blocks.push(createParagraph('No fixes implemented yet.'));
  }

  blocks.push(createHeading('Action Items', 1));
  if (postmortem.actionItems.length > 0) {
    for (const item of postmortem.actionItems) {
      let itemText = item.task;
      if (item.assignee) itemText += `\n*Assignee:* ${item.assignee}`;
      if (item.dueDate) itemText += `\n*Due:* ${item.dueDate}`;
      blocks.push(createToDo(itemText));
    }
  } else {
    blocks.push(createParagraph('No action items assigned.'));
  }

  return blocks;
}

function createHeading(text: string, level: number): NotionBlock {
  return {
    type: 'heading_1',
    heading_1: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function createParagraph(text: string): NotionBlock {
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function createBulletedListItem(text: string): NotionBlock {
  return {
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function createToDo(text: string): NotionBlock {
  return {
    type: 'to_do',
    to_do: {
      rich_text: [{ type: 'text', text: { content: text } }],
      checked: false,
    },
  };
}

function createDivider(): NotionBlock {
  return {
    type: 'divider',
    divider: {},
  };
}