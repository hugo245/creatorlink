import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { AppError } from './ledger';
import { config } from './config';

/**
 * File storage with two backends:
 *  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set -> a PRIVATE Supabase Storage bucket (production)
 *  - otherwise                                      -> local disk under DATA_DIR/uploads (development)
 * Files are never exposed by a public bucket URL; they are streamed through /files/* after an access check.
 */
const SB_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
const useSupabase = !!(SB_URL && SB_KEY);
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
export const sniff = (buf: Buffer) => SIGNATURES.find((s) => s.test(buf));

const sbHeaders = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY!, ...extra });
const sbObject = (rel: string) => `${SB_URL}/storage/v1/object/${BUCKET}/${rel.split('/').map(encodeURIComponent).join('/')}`;

export async function saveUpload(file: File, folder: string, opts: { imagesOnly?: boolean; maxBytes?: number } = {}) {
  const max = opts.maxBytes ?? config.maxUploadBytes;
  if (file.size === 0) throw new AppError('That file is empty.');
  if (file.size > max) throw new AppError(`Files must be under ${Math.round(max / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind || (opts.imagesOnly && !kind.mime.startsWith('image/'))) {
    throw new AppError(opts.imagesOnly ? 'Upload a PNG, JPG, GIF or WebP image.' : 'Upload an image (PNG, JPG, GIF, WebP) or a short video (MP4, WebM).');
  }
  const rel = `${folder}/${randomBytes(12).toString('hex')}.${kind.ext}`;
  if (useSupabase) {
    const r = await fetch(sbObject(rel), { method: 'POST', headers: sbHeaders({ 'Content-Type': kind.mime, 'x-upsert': 'false' }), body: new Uint8Array(buf) });
    if (!r.ok) {
      console.error('Supabase upload failed', r.status, await r.text().catch(() => ''));
      throw new AppError('Upload failed. Please try again.');
    }
  } else {
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf);
  }
  return { path: rel, mime: kind.mime };
}

export type StoredFile = { status: number; headers: Record<string, string>; body: ReadableStream };

/** Open a stored file (optionally a byte range). Returns null if it doesn't exist. */
export async function readUpload(rel: string, range?: string | null): Promise<StoredFile | null> {
  if (rel.split('/').some((p) => !p || p === '..' || p === '.')) return null;
  if (useSupabase) {
    const r = await fetch(sbObject(rel), { headers: sbHeaders(range ? { Range: range } : {}) });
    if (r.status === 416) return { status: 416, headers: { 'Content-Range': r.headers.get('content-range') ?? '' }, body: new ReadableStream() };
    if (!r.ok || !r.body) return null;
    const headers: Record<string, string> = {};
    for (const h of ['content-length', 'content-range']) if (r.headers.get(h)) headers[h] = r.headers.get(h)!;
    return { status: r.status, headers, body: r.body };
  }
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full)) return null;
  const size = fs.statSync(full).size;
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    if (start > end || start >= size) return { status: 416, headers: { 'Content-Range': `bytes */${size}` }, body: new ReadableStream() };
    return {
      status: 206,
      headers: { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      body: Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream,
    };
  }
  return { status: 200, headers: { 'Content-Length': String(size) }, body: Readable.toWeb(fs.createReadStream(full)) as ReadableStream };
}

export async function deleteUpload(rel: string | null) {
  if (!rel) return;
  try {
    if (useSupabase) await fetch(sbObject(rel), { method: 'DELETE', headers: sbHeaders() });
    else {
      const full = path.resolve(ROOT, rel);
      if (full.startsWith(ROOT + path.sep) && fs.existsSync(full)) fs.unlinkSync(full);
    }
  } catch (e) {
    console.error('deleteUpload failed', e);
  }
}
