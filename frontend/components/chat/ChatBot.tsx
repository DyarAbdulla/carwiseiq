'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { vazirmatn, inter } from '@/lib/fonts';

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

export default function ChatBot() {
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
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

  const colors = {
    bg: isDark ? 'bg-gray-900' : 'bg-white',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    inputBg: isDark ? 'bg-gray-800' : 'bg-gray-100',
    messageBg: isDark ? 'bg-gray-800' : 'bg-gray-100',
    shadow: isDark ? 'shadow-2xl' : 'shadow-xl'
  };

  useEffect(() => {
    const checkTheme = () => {
      const isDarkMode =
        document.documentElement.classList.contains('dark') ||
        (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Listen for open request from mobile menu
  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('open-chatbot', handler)
    return () => window.removeEventListener('open-chatbot', handler)
  }, [])

  return (
    <>
      {/* Chat Button - Desktop only (md: and above); mobile uses menu item */}
      {!isOpen && (
        <div className="hidden md:flex fixed bottom-20 right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
            aria-label="Open chat"
          >
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      )}

      {/* Chat Modal - Full screen on mobile, floating widget on desktop; Vazirmatn for RTL */}
      {isOpen && (
        <div
          className={`${fontClass} fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:left-auto z-50 flex flex-col overflow-hidden
            sm:w-[400px] sm:max-h-[600px] sm:h-[600px]
            w-full h-full sm:rounded-3xl sm:rounded-b-2xl
            ${colors.bg} border-0 sm:border ${colors.border} ${colors.shadow}
            pt-[env(safe-area-inset-top)] sm:pt-0 pb-[env(safe-area-inset-bottom)] sm:pb-0
            ${isRTL ? 'sm:right-auto sm:left-6' : ''}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header - Keep purple gradient */}
          <div
            className={`flex-shrink-0 bg-gradient-to-r from-purple-600 to-purple-700 p-4 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <h3 className="font-semibold text-white">{t.title}</h3>
                <p className="text-white/80 text-sm">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full text-white/90 hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${colors.bg} scrollbar-thin scrollbar-thumb-slate-400/30 dark:scrollbar-thumb-white/20 min-h-0`}>
            {messages.length === 0 && (
              <div className={`text-center mt-8 ${isRTL ? 'text-right' : ''}`}>
                <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-purple-500" />
                </div>
                <p className={`text-lg ${colors.text}`}>{t.welcome}</p>
                <p className={`text-sm mt-2 ${colors.textMuted}`}>{t.hint}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white ' + (isRTL ? 'rounded-tl-sm' : 'rounded-tr-sm')
                      : `${colors.messageBg} ${colors.text} ${colors.border} border ` + (isRTL ? 'rounded-tr-sm' : 'rounded-tl-sm')
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className={`${colors.messageBg} px-4 py-3 rounded-2xl ${colors.border} border ${isRTL ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className={`${colors.textMuted} text-sm`}>{t.thinking}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`flex-shrink-0 p-4 border-t ${colors.border} ${colors.bg}`}>
            {/* Quick reply suggestions - show when no messages yet */}
            {messages.length === 0 && t.quickReplies && (
              <div className="flex flex-wrap gap-2 mb-3">
                {t.quickReplies.map((reply: string, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(reply)}
                    disabled={isLoading}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${colors.border} ${colors.inputBg} ${colors.text} hover:bg-purple-600/20 hover:border-purple-500/50 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t.placeholder}
                className={`flex-1 ${colors.inputBg} ${colors.text} rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-gray-500 dark:placeholder-gray-400 ${colors.border} border ${isRTL ? 'text-right' : 'text-left'}`}
                disabled={isLoading}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
              >
                <Send className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
