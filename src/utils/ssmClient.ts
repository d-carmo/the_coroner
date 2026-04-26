import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const PARAMETER_CACHE: Record<string, string> = {};
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

export async function getParam(name: string): Promise<string> {
  if (PARAMETER_CACHE[name]) {
    return PARAMETER_CACHE[name];
  }

  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true,
    });

    const response = await ssmClient.send(command);
    const value = response.Parameter?.Value;

    if (!value) {
      throw new Error(`Parameter ${name} not found or empty`);
    }

    PARAMETER_CACHE[name] = value;
    return value;
  } catch (error) {
    console.error(`Failed to retrieve parameter ${name}:`, error);
    throw new Error(`Failed to retrieve parameter: ${name}`);
  }
}

export function getParamSync(name: string): string {
  // For synchronous access, we can't use SSM, so fall back to environment variables
  // This is mainly for CLAUDE_MAX_TOKENS which is used synchronously
  const envMap: Record<string, string> = {
    '/notion-pm/claude-max-tokens': process.env.CLAUDE_MAX_TOKENS || '4000',
  };

  return envMap[name] || process.env[name] || '';
}