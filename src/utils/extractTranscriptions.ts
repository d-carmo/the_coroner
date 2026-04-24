const TRANSCRIPTION_PROVIDERS = [
  'zoom.us',
  'meet.google.com',
  'loom.com',
  'otter.ai',
  'rev.com',
  'gong.io',
  'fireflies.ai',
];

export interface TranscriptionLink {
  url: string;
  provider: string;
}

export function extractTranscriptionLinks(text: string): TranscriptionLink[] {
  const links: TranscriptionLink[] = [];
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];

  for (const url of urls) {
    for (const provider of TRANSCRIPTION_PROVIDERS) {
      if (url.includes(provider)) {
        links.push({ url, provider });
        break;
      }
    }
  }

  return links;
}

export async function fetchTranscriptionContent(
  link: TranscriptionLink
): Promise<{ url: string; provider: string; content?: string }> {
  try {
    const response = await fetch(link.url, {
      headers: {
        'User-Agent': 'NotionPostmortemCreator/1.0',
      },
    });

    if (!response.ok) {
      return { url: link.url, provider: link.provider };
    }

    const html = await response.text();

    const content = extractTextFromHtml(html, link.provider);
    return { url: link.url, provider: link.provider, content };
  } catch {
    return { url: link.url, provider: link.provider };
  }
}

function extractTextFromHtml(html: string, provider: string): string {
  const textOnly = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (provider === 'otter.ai') {
    const match = textOnly.match(/([A-Z][^.!?]*[.!?])/g);
    return match?.slice(0, 50).join(' ') || textOnly.slice(0, 5000);
  }

  if (provider === 'zoom.us') {
    const match = textOnly.match(/([A-Z][^.!?]*[.!?])/g);
    return match?.slice(0, 50).join(' ') || textOnly.slice(0, 5000);
  }

  return textOnly.slice(0, 5000);
}

export async function fetchAllTranscriptions(
  links: TranscriptionLink[]
): Promise<{ url: string; provider: string; content?: string }[]> {
  const results = await Promise.all(
    links.map((link) => fetchTranscriptionContent(link))
  );
  return results.filter((r) => r.content && r.content.length > 0);
}