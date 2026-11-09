import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { AppError } from './ledger';
import { config } from './config';

const ROOT = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'uploads');

/** Allowed upload types, detected from magic bytes (never trust the client-supplied type). */
const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8' },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  { ext: 'mp4', mime: 'video/mp4', test: (b) => b.subarray(4, 8).toString('ascii') === 'ftyp' },
  { ext: 'webm', mime: 'video/webm', test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
];

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(SIGNATURES.map((s) => [s.ext, s.mime]));

export function sniff(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf));
}

export async function saveUpload(file: File, folder: string, opts: { imagesOnly?: boolean; maxBytes?: number } = {}) {
  const max = opts.maxBytes ?? config.maxUploadBytes;
  if (file.size === 0) throw new AppError('That file is empty.');
  if (file.size > max) throw new AppError(`Files must be under ${Math.round(max / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind || (opts.imagesOnly && !kind.mime.startsWith('image/'))) {
    throw new AppError(opts.imagesOnly ? 'Upload a PNG, JPG, GIF or WebP image.' : 'Upload an image (PNG, JPG, GIF, WebP) or a short video (MP4, WebM).');
  }
  const name = `${randomBytes(12).toString('hex')}.${kind.ext}`;
  const dir = path.join(ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return { path: `${folder}/${name}`, mime: kind.mime };
}

/** Resolve a stored relative path, refusing anything that escapes the uploads root. */
export function resolveUpload(rel: string): string | null {
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) return null;
  return fs.existsSync(full) ? full : null;
}

export function deleteUpload(rel: string | null) {
  if (!rel) return;
  const full = resolveUpload(rel);
  if (full) fs.unlinkSync(full);
}
