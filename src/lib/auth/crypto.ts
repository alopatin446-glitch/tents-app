import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split('.');
  if (parts.length !== 2) return false;

  const [hash, salt] = parts;
  if (!hash || !salt) return false;

  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(hashBuffer, derivedBuf);
  } catch {
    return false;
  }
}