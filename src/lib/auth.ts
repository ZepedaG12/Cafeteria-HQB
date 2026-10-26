import crypto from 'crypto';
import os from 'os';
import { cookies } from 'next/headers';
import { SessionUser } from './types';

export const SESSION_COOKIE_NAME = 'vitali_session';
const SECRET_KEY = process.env.AUTH_SECRET || 'vitalimarket-hospital-cafeteria-secret-2026';

export function hashPassword(plain: string): string {
  return crypto.createHmac('sha256', SECRET_KEY).update(plain).digest('hex');
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 días
    }),
    'utf-8'
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('base64url');

  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string): SessionUser | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('base64url');

  if (sig !== expectedSig) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return {
      id: parsed.id,
      username: parsed.username,
      fullName: parsed.fullName,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getLanUrls(port = 3000): string[] {
  const nets = os.networkInterfaces();
  const urls: string[] = [];

  for (const name of Object.keys(nets)) {
    const list = nets[name] || [];
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }

  const priority = (url: string) => {
    if (url.startsWith('http://192.168.')) return 1;
    if (url.startsWith('http://10.')) return 2;
    if (url.startsWith('http://172.')) return 3;
    return 4;
  };

  return urls.sort((a, b) => priority(a) - priority(b));
}
