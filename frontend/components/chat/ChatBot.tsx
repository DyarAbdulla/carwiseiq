'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { inter, notoSansArabic } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/context/AuthContext';
import { getPublicApiOrigin } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Strip markdown symbols (** etc) from AI responses for clean display */
function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

const GLASS_PANEL =
  'w-full overflow-hidden rounded-3xl border border-white/10 bg-gray-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl sm:w-[360px]'

/** Arabic / Arabic Presentation Forms-A block — Sorani, Arabic script */
function containsArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text)
}

function messageScriptStyle(
  content: string,
  options: { isThinkingPlaceholder: boolean; localeRtl: boolean }
): { dir: 'rtl' | 'ltr'; align: string; font: string } {
  if (options.isThinkingPlaceholder) {
    return options.localeRtl
      ? { dir: 'rtl', align: 'text-right', font: notoSansArabic.className }
      : { dir: 'ltr', align: 'text-left', font: inter.className }
  }
  if (containsArabicScript(content)) {
    return { dir: 'rtl', align: 'text-right', font: notoSansArabic.className }
  }
  return { dir: 'ltr', align: 'text-left', font: inter.className }
}

/** SSE events from POST /api/chat (text/event-stream). */
interface SseText {
  type: 'text'
  value: string
}
interface SseDone {
  type: 'done'
}
interface SseError {
  type: 'error'
  message?: string
}
type SseEvent = SseText | SseDone | SseError

export default function ChatBot() {
  const locale = useLocale();
  const t = useTranslations('chat');
  const { session } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [limitResetAt, setLimitResetAt] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [limitTick, setLimitTick] = useState(0);
  const [banUntil, setBanUntil] = useState<string | null>(null);
  const [banTick, setBanTick] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isRateLimited =
    !!limitResetAt && Number.isFinite(Date.parse(limitResetAt)) && Date.parse(limitResetAt) > Date.now();

  const isIpBanned =
    !!banUntil && Number.isFinite(Date.parse(banUntil)) && Date.parse(banUntil) > Date.now();

  useEffect(() => {
    if (!limitResetAt || !isRateLimited) return;
    const id = window.setInterval(() => setLimitTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [limitResetAt, isRateLimited]);

  useEffect(() => {
    if (!limitResetAt || !Number.isFinite(Date.parse(limitResetAt))) return;
    if (Date.parse(limitResetAt) <= Date.now()) {
      setLimitResetAt(null);
      setLimitMessage(null);
    }
  }, [limitResetAt, limitTick]);

  useEffect(() => {
    if (!banUntil || !Number.isFinite(Date.parse(banUntil))) return;
    if (Date.parse(banUntil) <= Date.now()) return;
    const id = window.setInterval(() => setBanTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [banUntil]);

  useEffect(() => {
    if (!banUntil || !Number.isFinite(Date.parse(banUntil))) return;
    if (Date.parse(banUntil) <= Date.now()) {
      setBanUntil(null);
    }
  }, [banUntil, banTick]);

  const quickReplies = (t.raw('quickReplies') as string[]) || [];
  const isRTL = locale === 'ku' || locale === 'ar';
  const shellFontClass = isRTL ? notoSansArabic.className : inter.className;

  const limitRemainingLabel = useMemo(() => {
    if (!limitResetAt || !Number.isFinite(Date.parse(limitResetAt))) return '';
    const left = Math.max(0, Date.parse(limitResetAt) - Date.now());
    const totalSec = Math.floor(left / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [limitResetAt, limitTick]);

  const banRemainingLabel = useMemo(() => {
    if (!banUntil || !Number.isFinite(Date.parse(banUntil))) return '';
    const left = Math.max(0, Date.parse(banUntil) - Date.now());
    const totalSec = Math.floor(left / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [banUntil, banTick]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const readSseStream = async (
    body: ReadableStream<Uint8Array> | null,
    signal: AbortSignal
  ) => {
    if (!body) throw new Error('No response body');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const appendAssistant = (chunk: string) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: (last.content || '') + chunk };
        }
        return next;
      });
    };

    const processSseEventBlock = (block: string) => {
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data: ')) continue;
        let json: SseEvent;
        try {
          json = JSON.parse(trimmed.slice(6)) as SseEvent;
        } catch {
          continue;
        }
        if (json.type === 'text' && 'value' in json && json.value) {
          appendAssistant(json.value);
        } else if (json.type === 'done') {
          return true;
        } else if (json.type === 'error') {
          const msg =
            typeof (json as SseError).message === 'string' && (json as SseError).message!.trim()
              ? (json as SseError).message!
              : t('error');
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              const base = last.content && last.content.trim() ? last.content + '\n\n' : '';
              next[next.length - 1] = { ...last, content: base + msg };
            }
            return next;
          });
          return true;
        }
      }
      return false;
    };

    while (true) {
      if (signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const normalized = buffer.replace(/\r\n/g, '\n');
      const parts = normalized.split('\n\n');
      buffer = parts.pop() || '';
      for (const block of parts) {
        if (processSseEventBlock(block)) return;
      }
    }
    if (buffer.trim()) {
      const normalized = buffer.replace(/\r\n/g, '\n');
      for (const block of normalized.split('\n\n')) {
        if (block.trim() && processSseEventBlock(block)) return;
      }
    }
  };

  const sendMessage = async (text?: string) => {
    const messageToSend = (text ?? input.trim()).trim();
    if (!messageToSend || isLoading || isRateLimited || isIpBanned) return;

    const userMessage = messageToSend;
    if (!text) setInput('');
    const previousMessages = messages;
    const payloadMessages: Message[] = [...previousMessages, { role: 'user', content: userMessage }];

    const chatUrl = `${getPublicApiOrigin()}/api/chat`;
    const streamTimeoutMs = 120000;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), streamTimeoutMs);

    try {
      setMessages([...payloadMessages, { role: 'assistant', content: '' }]);
      setIsLoading(true);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: payloadMessages,
          locale,
          stream: true,
        }),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        clearTimeout(timeout);
        setMessages(previousMessages);
        const data = (await response.json().catch(() => ({}))) as {
          detail?: unknown;
          error?: string;
          response?: string;
          banned?: boolean;
          ban_ends_at?: string;
          profanity_warning?: boolean;
        };

        const detail = data.detail;
        if (
          response.status === 429 &&
          typeof detail === 'object' &&
          detail !== null &&
          'code' in detail &&
          (detail as { code?: string }).code === 'chat_limit'
        ) {
          const d = detail as { reset_at?: string; message?: string };
          setLimitResetAt(d.reset_at ?? null);
          setLimitMessage(
            typeof d.message === 'string' ? d.message : t('limitFallback')
          );
          setIsLoading(false);
          return;
        }
        if (
          response.status === 403 &&
          typeof detail === 'object' &&
          detail !== null &&
          'code' in detail &&
          (detail as { code?: string }).code === 'ip_banned'
        ) {
          const d = detail as { ends_at?: string; message?: string };
          const banText =
            typeof d.message === 'string' && d.message.trim()
              ? d.message
              : t('banFallback');
          setMessages([...payloadMessages, { role: 'assistant', content: banText }]);
          if (d.ends_at) setBanUntil(d.ends_at);
          setIsLoading(false);
          return;
        }
        const detailMsg =
          typeof detail === 'string'
            ? detail
            : typeof data.error === 'string'
              ? data.error
              : `HTTP ${response.status}`;
        throw new Error(detailMsg);
      }

      if (contentType.includes('text/event-stream')) {
        setLimitResetAt(null);
        setLimitMessage(null);
        try {
          await readSseStream(response.body, controller.signal);
        } finally {
          clearTimeout(timeout);
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.content === '') {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: t('error') };
            return next;
          }
          return prev;
        });
        setIsLoading(false);
        return;
      }

      clearTimeout(timeout);
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        response?: string;
        banned?: boolean;
        ban_ends_at?: string;
        profanity_warning?: boolean;
      };
      if (data.error) {
        throw new Error(data.error);
      }

      setLimitResetAt(null);
      setLimitMessage(null);

      const assistantText =
        typeof data.response === 'string' ? data.response : t('error');
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { role: 'assistant', content: assistantText };
        } else {
          next.push({ role: 'assistant', content: assistantText });
        }
        return next;
      });

      if (data.banned && data.ban_ends_at) {
        setBanUntil(data.ban_ends_at);
      }

      setIsLoading(false);
    } catch (error) {
      clearTimeout(timeout);
      const aborted = error instanceof Error && error.name === 'AbortError';
      if (aborted) {
        setIsLoading(false);
        return;
      }
      console.error('Chat failed:', error);
      setMessages([...payloadMessages, { role: 'assistant', content: t('connectError') }]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('open-chatbot', handler)
    return () => window.removeEventListener('open-chatbot', handler)
  }, [])

  return (
    <>
      {!isOpen && (
        <div className="hidden md:flex fixed bottom-6 right-6 z-[60]">
          <button
            onClick={() => setIsOpen(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
            aria-label={t('openChat')}
          >
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className={`${shellFontClass} fixed inset-0 z-[100] flex flex-col sm:items-end sm:justify-end sm:p-4 md:p-6`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Layer 1–2: same treatment as About (static img + gradient; no CSS bg-fixed) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <img
              src="/background-about.jpg"
              alt=""
              className="h-full min-h-[100dvh] w-full object-cover object-center [transform:translateZ(0)]"
            />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-200/55 via-slate-100/35 to-white/50 backdrop-blur-[2px] dark:from-slate-950/80 dark:via-slate-950/60 dark:to-[#0a0f1c]"
          />

          {/* Glass shell: full viewport on mobile; floating card on sm+ */}
          <div
            className={cn(
              'relative z-10 flex h-[calc(100dvh-80px)] max-h-[100dvh] min-h-0 w-full flex-col sm:h-[min(600px,calc(100vh-5rem))] sm:max-h-[600px] sm:flex-none',
              GLASS_PANEL,
              isRTL ? 'sm:ml-6 sm:mr-auto' : 'sm:mr-0'
            )}
          >
            <div
              className={cn(
                'flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-transparent px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
                isRTL && 'flex-row-reverse'
              )}
            >
              <div className={cn('flex min-w-0 flex-1 items-center gap-3', isRTL && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5',
                    isLoading &&
                      'shadow-[0_0_24px_rgba(168,85,247,0.55)] ring-2 ring-purple-500/40 animate-pulse'
                  )}
                >
                  <Bot className="h-5 w-5 text-gray-200" />
                </div>
                <div className={cn(isRTL ? 'text-right' : 'text-left')}>
                  <div
                    className={cn(
                      'inline-flex max-w-full flex-wrap items-center gap-2',
                      isRTL && 'flex-row-reverse'
                    )}
                  >
                    <h3 className="text-base font-semibold text-white sm:text-lg">{t('title')}</h3>
                    <span
                      className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/35"
                      aria-hidden
                    />
                  </div>
                  <div
                    className={cn(
                      'pointer-events-none mt-1.5 h-px max-w-[220px] bg-gradient-to-r from-transparent via-purple-400/55 to-transparent',
                      isRTL ? 'ms-auto bg-gradient-to-l' : ''
                    )}
                  />
                  <p className="mt-1 text-sm text-gray-400">{t('subtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={t('closeChat')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              className={cn(
                'scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto bg-transparent p-4'
              )}
            >
              {messages.length === 0 && (
                <div className={cn('mt-6 text-center', isRTL && 'text-right')}>
                  <div
                    className={cn(
                      'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5',
                      isLoading && 'shadow-[0_0_28px_rgba(168,85,247,0.45)] animate-pulse'
                    )}
                  >
                    <Bot className="h-8 w-8 text-purple-300" />
                  </div>
                  <p className="text-lg leading-relaxed text-gray-100">{t('welcome')}</p>
                  <p className="mt-2 text-sm text-gray-400">{t('hint')}</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isThinkingBubble =
                  msg.role === 'assistant' &&
                  msg.content === '' &&
                  isLoading &&
                  i === messages.length - 1;
                const scr = messageScriptStyle(msg.content, {
                  isThinkingPlaceholder: isThinkingBubble,
                  localeRtl: isRTL,
                });
                return (
                <div
                  key={i}
                  className={cn(
                    'flex',
                    msg.role === 'user'
                      ? isRTL
                        ? 'justify-start'
                        : 'justify-end'
                      : isRTL
                        ? 'justify-end'
                        : 'justify-start'
                  )}
                >
                  <div
                    dir={scr.dir}
                    className={cn(
                      'max-w-[85%] rounded-2xl border p-3 leading-relaxed shadow-lg',
                      scr.font,
                      scr.align,
                      msg.role === 'user'
                        ? cn(
                          'border-transparent bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-black/25',
                          isRTL ? 'rounded-tl-sm' : 'rounded-tr-sm'
                        )
                        : cn(
                          'border-white/10 bg-white/5 text-gray-100 shadow-black/30 backdrop-blur-md',
                          isRTL ? 'rounded-tr-sm' : 'rounded-tl-sm'
                        )
                    )}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-inherit">
                      {msg.role === 'assistant' ? (
                        isThinkingBubble ? (
                          <span className="inline-flex flex-wrap items-center gap-2 text-gray-300">
                            <span className="inline-flex items-center gap-1" aria-hidden>
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-chat-dots"
                                style={{ animationDelay: '0ms' }}
                              />
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-chat-dots"
                                style={{ animationDelay: '160ms' }}
                              />
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-chat-dots"
                                style={{ animationDelay: '320ms' }}
                              />
                            </span>
                            <span>{t('thinking')}</span>
                          </span>
                        ) : (
                          <>
                            {stripMarkdown(msg.content)}
                            {isLoading && i === messages.length - 1 && (
                              <span
                                className="ms-0.5 inline-block h-[1.1em] w-0.5 translate-y-px animate-pulse rounded-sm bg-violet-400"
                                aria-hidden
                              />
                            )}
                          </>
                        )
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-white/10 bg-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {isIpBanned && (
                <div
                  className={cn(
                    'mb-3 rounded-xl border border-red-300/50 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-100/95',
                    isRTL && 'text-right'
                  )}
                  role="alert"
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{t('banActiveHint')}</p>
                  {banRemainingLabel ? (
                    <p
                      className={cn(
                        'mt-2 font-mono text-xs tabular-nums text-red-800 dark:text-red-200/90',
                        isRTL && 'text-right'
                      )}
                    >
                      {t('resetIn', { time: banRemainingLabel })}
                    </p>
                  ) : null}
                  <div className={cn('mt-3 flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                    <a
                      href="mailto:carwise15@gmail.com"
                      className="inline-flex items-center justify-center rounded-lg border border-red-300/60 bg-red-100/80 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-200/80 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-500/20"
                    >
                      {t('supportEmail')}
                    </a>
                    <a
                      href="tel:+9647774472106"
                      className="inline-flex items-center justify-center rounded-lg border border-red-300/60 bg-red-100/80 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-200/80 ltr-embed dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-500/20"
                      dir="ltr"
                    >
                      0777 447 2106
                    </a>
                  </div>
                </div>
              )}
              {(limitMessage || isRateLimited) && (
                <div
                  className={cn(
                    'mb-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100/95',
                    isRTL && 'text-right'
                  )}
                  role="alert"
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {limitMessage || t('limitFallback')}
                  </p>
                  {isRateLimited && limitRemainingLabel ? (
                    <p
                      className={cn(
                        'mt-2 font-mono text-xs tabular-nums text-amber-800 dark:text-amber-200',
                        isRTL && 'text-right'
                      )}
                    >
                      {t('resetIn', { time: limitRemainingLabel })}
                    </p>
                  ) : null}
                  <div className={cn('mt-3 flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                    <a
                      href="mailto:carwise15@gmail.com"
                      className="inline-flex items-center justify-center rounded-lg border border-amber-300/60 bg-amber-100/90 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200/80 dark:border-amber-400/40 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-500/15"
                    >
                      {t('supportEmail')}
                    </a>
                    <a
                      href="tel:+9647774472106"
                      className="inline-flex items-center justify-center rounded-lg border border-amber-300/60 bg-amber-100/90 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200/80 ltr-embed dark:border-amber-400/40 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-500/15"
                      dir="ltr"
                    >
                      0777 447 2106
                    </a>
                  </div>
                </div>
              )}
              {messages.length === 0 && quickReplies.length > 0 && (
                <div className={cn('mb-3 flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                  {quickReplies.map((reply: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(reply)}
                      disabled={isLoading || isRateLimited || isIpBanned}
                      className={cn(
                        'rounded-full border border-purple-500/40 bg-transparent px-4 py-2 text-sm text-gray-200 transition-all duration-200',
                        'hover:bg-purple-500/20 hover:text-white',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
              <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void sendMessage()}
                  placeholder={t('placeholder')}
                  className={cn(
                    'min-h-[48px] flex-1 rounded-full border border-white/15 bg-white/[0.08] px-4 py-3 text-[16px] text-gray-100',
                    'placeholder:text-gray-500/90 focus:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/25',
                    isRTL && 'text-right'
                  )}
                  disabled={isLoading || isRateLimited || isIpBanned}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isLoading || isRateLimited || isIpBanned || !input.trim()}
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-600/80 text-white transition-all',
                    'hover:border-purple-400/50 hover:bg-purple-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.55)]',
                    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none'
                  )}
                  aria-label={t('send')}
                >
                  <Send className={cn('h-5 w-5', isRTL && 'rotate-180')} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
