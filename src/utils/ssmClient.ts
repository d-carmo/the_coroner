const PARAMETER_CACHE: Record<string, string> = {};

export async function getParam(name: string): Promise<string> {
  if (PARAMETER_CACHE[name]) {
    return PARAMETER_CACHE[name];
  }

  const envMap: Record<string, string> = {
    '/notion-pm/slack-bot-token': process.env.SLACK_BOT_TOKEN || '',
    '/notion-pm/slack-signing-secret': process.env.SLACK_SIGNING_SECRET || '',
    '/notion-pm/notion-api-key': process.env.NOTION_API_KEY || '',
    '/notion-pm/notion-incidents-parent-id': process.env.NOTION_INCIDENTS_PARENT_ID || '',
    '/notion-pm/claude-api-key': process.env.CLAUDE_API_KEY || '',
  };

  PARAMETER_CACHE[name] = envMap[name] || '';
  return PARAMETER_CACHE[name];
}

export function getParamSync(name: string): string {
  return process.env[name] || '';
}