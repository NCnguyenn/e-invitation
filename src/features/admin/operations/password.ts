import crypto from 'node:crypto';

export function generateSecurePassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all = upper + lower + numbers + symbols;

  let pwd = '';
  pwd += upper[crypto.randomInt(upper.length)];
  pwd += lower[crypto.randomInt(lower.length)];
  pwd += numbers[crypto.randomInt(numbers.length)];
  pwd += symbols[crypto.randomInt(symbols.length)];

  for (let i = 4; i < length; i++) {
    pwd += all[crypto.randomInt(all.length)];
  }

  // Shuffle characters
  return pwd.split('').sort(() => crypto.randomInt(3) - 1).join('');
}
