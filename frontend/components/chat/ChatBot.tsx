'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { vazirmatn, inter } from '@/lib/fonts';
import { cn } from '@/lib/utils';

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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const translations = {
    en: {
      title: 'CarWiseIQ Assistant',
      subtitle: 'Ask me anything!',
      welcome: "Hi! 👋 I'm here to help with car valuations and buying/selling. What can I help you with?",
      hint: 'Tap a suggestion below or type your question',
      placeholder: 'Type your message...',
      error: 'Sorry, something went wrong. Please try again.',
      thinking: 'Thinking...',
      quickReplies: [
        '💰 How much is my car worth?',
        '🚗 How to sell my car?',
        '🔍 Find cars under $15,000',
        '📊 Compare two cars',
        '❓ How does CarWiseIQ work?',
      ],
    },
    ku: {
      title: 'یاریدەدەری CarWiseIQ',
      subtitle: 'پرسیارەکانت بکە، وەڵامت دەدەمەوە!',
      welcome: 'سڵاو! 👋 من لێرەم بۆ یارمەتیدان لە نرخاندن و کڕین و فرۆشتنی ئۆتۆمبێل. چۆن دەتوانم یارمەتیت بدەم؟',
      hint: 'یەکێک لە پرسیارەکان هەڵبژێرە یان پرسیارەکەت بنووسە',
      placeholder: 'پەیامەکەت بنووسە...',
      error: 'ببورە، هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەوە.',
      thinking: 'بیردەکەمەوە...',
      quickReplies: [
        '💰 ئۆتۆمبێڵەکەم چەند دەبێت؟',
        '🚗 چۆن ئۆتۆمبێڵ بفرۆشم؟',
        '🔍 ئۆتۆمبێڵ لە خوار ١٥٠٠٠$',
        '📊 دوو ئۆتۆمبێڵ بەراورد بکە',
        '❓ CarWiseIQ چۆن کاردەکات؟',
      ],
    },
    ar: {
      title: 'مساعد CarWiseIQ',
      subtitle: 'اسألني وسأجيبك!',
      welcome: 'مرحباً! 👋 أنا هنا لمساعدتك في تقييم وشراء وبيع السيارات. كيف يمكنني مساعدتك؟',
      hint: 'اختر اقتراحاً أدناه أو اكتب سؤالك',
      placeholder: 'اكتب رسالتك...',
      error: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.',
      thinking: 'جاري التفكير...',
      quickReplies: [
        '💰 كم تساوي سيارتي؟',
        '🚗 كيف أبيع سيارتي؟',
        '🔍 سيارات أقل من ١٥٠٠٠$',
        '📊 قارن سيارتين',
        '❓ كيف يعمل CarWiseIQ؟',
      ],
    },
  };

  const t = translations[locale as keyof typeof translations] || translations.en;
  const isRTL = locale === 'ku' || locale === 'ar';
  const fontClass = isRTL ? vazirmatn.className : inter.className;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text?: string) => {
    const messageToSend = (text ?? input.trim()).trim()
    if (!messageToSend || isLoading) return

    const userMessage = messageToSend
    if (!text) setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    const maxRetries = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
        const chatUrl = base ? `${base}/api/chat` : '/api/chat';
        const response = await fetch(chatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [...messages, { role: 'user', content: userMessage }],
              locale
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeout);

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.detail || data.error || `HTTP ${response.status}`);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        setIsLoading(false);
        return;
      } catch (error) {
        lastError = error;
        console.error(`Chat attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }
    }

    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content:
          locale === 'ku'
            ? 'ببورە، نەتوانرا پەیوەندی بکرێت. تکایە دووبارە هەوڵ بدە.'
            : locale === 'ar'
              ? 'عذراً، تعذر الاتصال. يرجى المحاولة مرة أخرى.'
              : 'Sorry, could not connect. Please try again.'
      }
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
            aria-label="Open chat"
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
                    {t.title}
                  </h3>
                  <p className="text-sm text-gray-400">{t.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
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
                  <p className="text-lg leading-relaxed text-gray-100">{t.welcome}</p>
                  <p className="mt-2 text-sm text-gray-400">{t.hint}</p>
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
                      <span className="text-sm text-gray-400">{t.thinking}</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-white/[0.08] bg-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {messages.length === 0 && t.quickReplies && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {t.quickReplies.map((reply: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(reply)}
                      disabled={isLoading}
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
                  placeholder={t.placeholder}
                  className={cn(
                    'min-h-[48px] flex-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[16px] text-gray-100 shadow-inner shadow-black/20',
                    'placeholder:text-gray-500 focus:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/25',
                    isRTL && 'text-right'
                  )}
                  disabled={isLoading}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-600/80 text-white transition-all',
                    'hover:border-purple-400/50 hover:bg-purple-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.55)]',
                    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none'
                  )}
                  aria-label="Send"
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
