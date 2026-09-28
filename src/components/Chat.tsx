'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clockTime } from '@/lib/format';
import type { Message } from '@/lib/types';

interface Props {
  jobId: string;
  currentUserId: string;
  counterpartyId: string | null;
  counterpartyName: string;
  initialMessages: Message[];
  backPath: string;
  sendAction: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * In-job chat. Uses Supabase Realtime when the socket connects and silently
 * falls back to 8s polling (handy on flaky mobile data in Lae).
 */
export default function Chat({
  jobId,
  currentUserId,
  counterpartyId,
  counterpartyName,
  initialMessages,
  backPath,
  sendAction,
  disabled,
  disabledReason,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [live, setLive] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // keep in sync when the server re-renders the page
  useEffect(() => {
    setMessages((prev) => (initialMessages.length >= prev.length ? initialMessages : prev));
  }, [initialMessages]);

  const merge = (incoming: Message[]) =>
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const added = incoming.filter((m) => !seen.has(m.id));
      return added.length ? [...prev, ...added] : prev;
    });

  // 1) Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`job-chat-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
        (payload) => merge([payload.new as Message]),
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, supabase]);

  // 2) Polling fallback while the socket is not connected
  useEffect(() => {
    if (live) return;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (data) merge(data as Message[]);
    }, 8000);
    return () => clearInterval(timer);
  }, [live, jobId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  return (
    <div className="tc-card flex h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <p className="text-sm font-semibold text-ink-800">Chat with {counterpartyName}</p>
        <span className="flex items-center gap-1.5 text-xs text-ink-400">
          <span
            className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-gold-500'}`}
            aria-hidden
          />
          {live ? 'Live' : 'Syncing'}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-400">
            No messages yet — say hello and agree on a time.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? 'rounded-br-sm bg-brand-600 text-white'
                    : 'rounded-bl-sm bg-ink-100 text-ink-800'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-brand-100' : 'text-ink-400'}`}>
                  {clockTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {disabled ? (
        <p className="border-t border-ink-100 px-4 py-3 text-xs text-ink-400">{disabledReason}</p>
      ) : (
        <form
          action={sendAction}
          onSubmit={() => setTimeout(() => setDraft(''), 0)}
          className="flex items-end gap-2 border-t border-ink-100 p-3"
        >
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="receiver_id" value={counterpartyId ?? ''} />
          <input type="hidden" name="back" value={backPath} />
          <textarea
            name="body"
            required
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            className="tc-input max-h-24 min-h-[42px] resize-y py-2"
          />
          <button type="submit" className="tc-btn-primary px-3 py-2.5">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
