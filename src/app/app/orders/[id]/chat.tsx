'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, SendHorizonal, X } from 'lucide-react';
import { sendMessage } from '@/app/actions/orders';
import { Avatar } from '@/components/avatar';
import { dateTime } from '@/lib/format';
import type { Msg } from '@/lib/queries';

export function Chat({ orderId, userId, initial, canSend }: { orderId: string; userId: string; initial: Msg[]; canSend: boolean }) {
  const [msgs, setMsgs] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const atBottom = useRef(true);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders/${orderId}/messages`, { cache: 'no-store' });
      if (r.ok) setMsgs((await r.json()).messages);
    } catch { /* offline, try again next tick */ }
  }, [orderId]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && poll(), 4000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const r = await sendMessage(orderId, null, fd);
    setSending(false);
    if (r?.error) return setErr(r.error);
    form.current?.reset();
    setFile(null);
    atBottom.current = true;
    poll();
  }

  return (
    <section className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card lg:h-[calc(100vh-9rem)] lg:max-h-[720px]" aria-label="Conversation">
      <h2 className="border-b border-line px-5 py-3.5 font-display font-bold">Conversation</h2>
      <div
        ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-paper/60 p-4"
        aria-live="polite"
      >
        {msgs.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="mx-auto max-w-[90%] rounded-lg bg-paper-3 px-3 py-2 text-center text-xs leading-snug text-ink-2">{m.body}</p>
          ) : (
            <div key={m.id} className={`flex items-end gap-2 ${m.sender_id === userId ? 'flex-row-reverse' : ''}`}>
              <Avatar name={m.sender_name ?? '?'} src={m.sender_avatar} size={26} />
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug ${m.sender_id === userId ? 'rounded-br-md bg-ink text-paper' : 'rounded-bl-md border border-line bg-white'}`}>
                {m.file_path && m.file_type?.startsWith('image/') && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={`/files/${m.file_path}`} target="_blank" rel="noopener noreferrer"><img src={`/files/${m.file_path}`} alt={m.file_name ?? 'Attachment'} className="mb-1.5 max-h-56 rounded-lg" /></a>
                )}
                {m.file_path && m.file_type?.startsWith('video/') && <video src={`/files/${m.file_path}`} controls preload="metadata" className="mb-1.5 max-h-56 rounded-lg" />}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.flagged ? <p className={`mt-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-snug ${m.sender_id === userId ? 'bg-white/10 text-paper/80' : 'bg-amber-soft text-amber'}`}>Careful: this mentions payment or contact outside CreatorLink. Escrow only protects orders paid here. Never share passwords or codes.</p> : null}
                <p className={`mt-1 text-[11px] ${m.sender_id === userId ? 'text-paper/50' : 'text-ink-4'}`}>{dateTime(m.created_at)}</p>
              </div>
            </div>
          ),
        )}
      </div>
      {canSend ? (
        <form ref={form} onSubmit={onSubmit} className="border-t border-line p-3">
          {file && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-paper-2 px-3 py-1.5 text-xs font-medium">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => { setFile(null); const i = form.current?.elements.namedItem('file') as HTMLInputElement; if (i) i.value = ''; }} aria-label="Remove attachment"><X size={14} /></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="btn btn-ghost h-11 w-11 shrink-0 cursor-pointer px-0" title="Attach image or video">
              <Paperclip size={18} /><span className="sr-only">Attach file</span>
              <input type="file" name="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <textarea
              name="body" rows={1} maxLength={2000} placeholder="Write a message…" aria-label="Message" className="field max-h-32 min-h-11 flex-1 resize-none py-2.5"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.current?.requestSubmit(); } }}
            />
            <button type="submit" disabled={sending} className="btn btn-primary h-11 w-11 shrink-0 px-0" aria-label="Send"><SendHorizonal size={18} /></button>
          </div>
          {err && <p role="alert" className="mt-2 text-xs font-medium text-signal-dark">{err}</p>}
        </form>
      ) : (
        <p className="border-t border-line px-4 py-3 text-center text-xs text-ink-3">This conversation is closed.</p>
      )}
    </section>
  );
}
