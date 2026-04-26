import { randomBytes, createHash } from 'crypto';
import { SESSION_DURATION_MS } from './constants';

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}