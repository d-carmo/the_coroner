import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SlackSlashCommandPayload } from '../types';
import { verifySlackSignature } from '../utils/slackVerification';
import { parseFormData } from '../utils/helpers';
import { createIncidentPostmortem } from '../services/postmortemService';
import { postEphemeralMessage, postResponseUrl } from '../clients/slackClient';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('EVENT:', JSON.stringify(event));

    const queryParams = event.queryStringParameters || {};
    const body = event.body || '';
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const isJson = contentType.includes('application/json') || body.startsWith('{');

    let challenge = '';

    if (isJson) {
      try {
        const json = JSON.parse(body);
        if (json.challenge) {
          challenge = json.challenge;
        }
      } catch {}
    } else {
      challenge = queryParams.challenge || (body.match(/challenge=([^&]+)/)?.[1] || '');
    }

    console.log('CHALLENGE:', challenge, 'BODY:', body.substring(0, 100));

    if (challenge) {
      return {
        statusCode: 200,
        body: challenge,
        headers: { 'Content-Type': 'text/plain' },
      };
    }

    const timestamp = event.headers['x-slack-request-timestamp'] || '';
    const signature = event.headers['x-slack-signature'] || '';

    const isValid = await verifySlackSignature(body, timestamp, signature);
    console.log('Signature valid:', isValid);
    if (!isValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature', ts: timestamp }),
      };
    }

    const payload = parseFormData(body) as unknown as SlackSlashCommandPayload;

    if (payload.command !== '/generate-postmortem') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid command' }),
      };
    }

    const channelId = payload.channel_id;
    const channelName = payload.channel_name;
    const userId = payload.user_id;
    const responseUrl = payload.response_url;

    console.log('Starting postmortem creation for channel:', channelId);

    try {
      const { pageUrl, pageTitle } = await createIncidentPostmortem(channelId, channelName);
      console.log('Postmortem created:', pageTitle);

      const successMessage = `✅ Postmortem created: ${pageTitle}\n<${pageUrl}|Open in Notion>`;
      await postResponseUrl(responseUrl, successMessage).catch((e) => {
        console.error('Failed to post success response:', e);
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_type: 'ephemeral', text: successMessage }),
      };
    } catch (error: any) {
      console.error('Postmortem creation failed:', error);
      const errorMessage = `❌ Failed: ${error?.message || 'Unknown error'}`;

      await postResponseUrl(responseUrl, errorMessage).catch((e) => {
        console.error('Failed to post error response:', e);
      });

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_type: 'ephemeral', text: errorMessage }),
      };
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate postmortem' }),
    };
  }
}