'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { vazirmatn, inter } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/context/AuthContext';

function apiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';
  return raw.replace(/\/$/, '').replace('http://localhost', 'http://127.0.0.1');
}

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
  'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-2xl overflow-hidden'

const TITLE_GRADIENT =
  'bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent'

const SCROLL_AREA =
  'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20'

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isRateLimited =
    !!limitResetAt && Number.isFinite(Date.parse(limitResetAt)) && Date.parse(limitResetAt) > Date.now();

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

  const quickReplies = (t.raw('quickReplies') as string[]) || [];
  const isRTL = locale === 'ku' || locale === 'ar';
  const fontClass = isRTL ? vazirmatn.className : inter.className;

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text?: string) => {
    const messageToSend = (text ?? input.trim()).trim();
    if (!messageToSend || isLoading || isRateLimited) return;

    const userMessage = messageToSend;
    if (!text) setInput('');
    const previousMessages = messages;
    const payloadMessages: Message[] = [...previousMessages, { role: 'user', content: userMessage }];
    setMessages(payloadMessages);
    setIsLoading(true);

    const maxRetries = 3;
    let lastError: unknown = null;

    const base = apiBaseUrl();
    const chatUrl = base ? `${base}/api/chat` : '/api/chat';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

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
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = (await response.json().catch(() => ({}))) as {
          detail?: unknown;
          error?: string;
          response?: string;
          banned?: boolean;
          ban_ends_at?: string;
          profanity_warning?: boolean;
        };

        if (!response.ok) {
          const detail = data.detail;
          if (
            response.status === 429 &&
            typeof detail === 'object' &&
            detail !== null &&
            'code' in detail &&
            (detail as { code?: string }).code === 'chat_limit'
          ) {
            const d = detail as { reset_at?: string; message?: string };
            setMessages(previousMessages);
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
            const d = detail as { ends_at?: string };
            setMessages(previousMessages);
            if (d.ends_at) {
              window.location.assign(
                `/${locale}/banned?until=${encodeURIComponent(d.ends_at)}`
              );
            }
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

        if (data.error) {
          throw new Error(data.error);
        }

        setLimitResetAt(null);
        setLimitMessage(null);

        const assistantText =
          typeof data.response === 'string' ? data.response : t('error');
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);

        if (data.banned && data.ban_ends_at) {
          window.location.assign(
            `/${locale}/banned?until=${encodeURIComponent(data.ban_ends_at)}`
          );
        }

        setIsLoading(false);
        return;
      } catch (error) {
        lastError = error;
        console.error(`Chat attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }

    setMessages([
      ...previousMessages,
      {
        role: 'assistant',
        content: t('connectError'),
      },
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('open-chatbot', handler)
    return () => window.removeEventListener('open-chatbot', handler)
  }, [])

  return (
    <>
      {!isOpen && (
        <div className="hidden md:flex fixed bottom-20 right-6 z-[60]">
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
          className={`${fontClass} fixed inset-0 z-[100] flex flex-col sm:items-end sm:justify-end sm:p-4 md:p-6`}
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
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-[#0a0f1c] backdrop-blur-[2px]"
          />

          {/* Glass shell: full viewport on mobile; floating card on sm+ */}
          <div
            className={cn(
              'relative z-10 flex min-h-0 w-full flex-col sm:max-h-[600px] sm:w-[400px] sm:flex-none sm:rounded-3xl',
              GLASS_PANEL,
              /* Mobile: ~80px for app header/chrome; desktop: floating card */
              'h-[calc(100dvh-80px)] max-h-[100dvh] sm:h-[min(600px,calc(100vh-5rem))]',
              isRTL ? 'sm:ml-6 sm:mr-auto' : 'sm:mr-0'
            )}
          >
            {/* Transparent header — gradient title */}
            <div
              className={cn(
                'flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] bg-transparent px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
                isRTL && 'flex-row-reverse'
              )}
            >
              <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5',
                    isLoading &&
                      'shadow-[0_0_24px_rgba(168,85,247,0.55)] ring-2 ring-purple-500/40 animate-pulse'
                  )}
                >
                  <Bot className="h-5 w-5 text-gray-200" />
                </div>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <h3 className={cn('text-base font-semibold sm:text-lg', TITLE_GRADIENT)}>
                    {t('title')}
                  </h3>
                  <p className="text-sm text-gray-400">{t('subtitle')}</p>
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
                'min-h-0 flex-1 space-y-4 overflow-y-auto bg-transparent p-4',
                SCROLL_AREA
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
                    <Bot className="h-8 w-8 text-purple-300/90" />
                  </div>
                  <p className="text-lg leading-relaxed text-gray-100">{t('welcome')}</p>
                  <p className="mt-2 text-sm text-gray-400">{t('hint')}</p>
                </div>
              )}

              {messages.map((msg, i) => (
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
                    className={cn(
                      'max-w-[85%] rounded-2xl border p-3 leading-relaxed',
                      msg.role === 'user'
                        ? cn(
                            'border-purple-500/20 bg-purple-500/10 text-gray-100',
                            isRTL ? 'rounded-tl-sm' : 'rounded-tr-sm'
                          )
                        : cn(
                            'border-white/10 bg-white/5 text-gray-100',
                            isRTL ? 'rounded-tr-sm' : 'rounded-tl-sm'
                          )
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className={cn('flex', isRTL ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'rounded-2xl border border-white/10 bg-white/5 px-4 py-3',
                      isRTL ? 'rounded-tr-sm' : 'rounded-tl-sm'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10',
                          'shadow-[0_0_20px_rgba(168,85,247,0.5)] animate-pulse'
                        )}
                      >
                        <Bot className="h-4 w-4 text-purple-200" />
                      </div>
                      <div className="flex gap-1">
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-purple-400"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-purple-400"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-purple-400"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                      <span className="text-sm text-gray-400">{t('thinking')}</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-white/[0.08] bg-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {(limitMessage || isRateLimited) && (
                <div
                  className={cn(
                    'mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/95',
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
                        'mt-2 font-mono text-xs tabular-nums text-amber-200',
                        isRTL && 'text-right'
                      )}
                    >
                      {t('resetIn', { time: limitRemainingLabel })}
                    </p>
                  ) : null}
                </div>
              )}
              {messages.length === 0 && quickReplies.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickReplies.map((reply: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(reply)}
                      disabled={isLoading || isRateLimited}
                      className={cn(
                        'rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-left text-sm font-medium text-gray-200 transition-colors',
                        'hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        isRTL && 'text-right'
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
                    'min-h-[48px] flex-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[16px] text-gray-100 shadow-inner shadow-black/20',
                    'placeholder:text-gray-500 focus:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/25',
                    isRTL && 'text-right'
                  )}
                  disabled={isLoading || isRateLimited}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isLoading || isRateLimited || !input.trim()}
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
