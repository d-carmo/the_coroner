import crypto from 'crypto';
import { getParam } from './ssmClient';

let signingSecret: string | null = null;

async function getSigningSecret(): Promise<string> {
  if (!signingSecret) {
    signingSecret = await getParam('/notion-pm/slack-signing-secret');
  }
  return signingSecret;
}

export async function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const timeDiff = now - parseInt(timestamp, 10);

  if (timeDiff > 300) {
    console.log('Signature timestamp too old:', timeDiff);
    return false;
  }

  if (!signature || !signature.startsWith('v0=')) {
    console.log('Invalid signature format:', signature);
    return false;
  }

  const secret = await getSigningSecret();
  if (!secret) {
    console.log('Signing secret not configured in SSM');
    return false;
  }

  const base = `v0:${timestamp}:${body}`;
  const mySignature =
    'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
  } catch (e) {
    console.log('Signature comparison failed:', e);
    return false;
  }
}