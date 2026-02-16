'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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
      welcome: 'Hello! 👋 How can I help you today?',
      hint: 'Ask about car prices, features, or how to use CarWiseIQ',
      placeholder: 'Type your message...',
      error: 'Sorry, something went wrong. Please try again.'
    },
    ku: {
      title: 'یاریدەدەری CarWiseIQ',
      subtitle: 'هەر شتێکم لێ بپرسە!',
      welcome: 'سڵاو! 👋 چۆن دەتوانم یارمەتیت بدەم؟',
      hint: 'دەربارەی نرخی ئۆتۆمبێل، تایبەتمەندییەکان، یان چۆنیەتی بەکارهێنانی CarWiseIQ بپرسە',
      placeholder: 'پەیامەکەت بنووسە...',
      error: 'ببورە، هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەوە.'
    },
    ar: {
      title: 'مساعد CarWiseIQ',
      subtitle: 'اسألني أي شيء!',
      welcome: 'مرحباً! 👋 كيف يمكنني مساعدتك اليوم؟',
      hint: 'اسأل عن أسعار السيارات أو الميزات أو كيفية استخدام CarWiseIQ',
      placeholder: 'اكتب رسالتك...',
      error: 'عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى.'
    }
  };

  const t = translations[locale as keyof typeof translations] || translations.en;
  const isRTL = locale === 'ku' || locale === 'ar';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
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

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white p-4 rounded-full shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Modal - Full screen on mobile, floating widget on desktop */}
      {isOpen && (
        <div
          className={`fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:left-auto z-50 flex flex-col overflow-hidden
            sm:w-[400px] sm:max-h-[600px] sm:h-[600px]
            w-full h-full sm:rounded-3xl sm:rounded-b-2xl
            bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl
            border-0 sm:border border-black/5 dark:border-white/10
            shadow-2xl
            pt-[env(safe-area-inset-top)] sm:pt-0 pb-[env(safe-area-inset-bottom)] sm:pb-0
            ${isRTL ? 'sm:right-auto sm:left-6' : ''}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Ambient glow behind chatbot (desktop only) */}
          <div
            className="hidden sm:block absolute -z-10 -inset-4 rounded-3xl opacity-60 pointer-events-none overflow-hidden"
            aria-hidden
          >
            <div
              className="absolute inset-0 rounded-3xl blur-3xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%)'
              }}
            />
          </div>

          {/* Header */}
          <div
            className={`flex-shrink-0 p-4 flex items-center justify-between border-b border-black/5 dark:border-white/10 ${
              isRTL ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 dark:bg-white/10 flex items-center justify-center border border-purple-400/20 dark:border-white/10">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <h3 className="font-semibold bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  {t.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-400/30 dark:scrollbar-thumb-white/20 min-h-0">
            {messages.length === 0 && (
              <div className={`text-center mt-8 ${isRTL ? 'text-right' : ''}`}>
                <div className="w-16 h-16 rounded-full bg-purple-500/20 dark:bg-purple-600/20 flex items-center justify-center mx-auto mb-4 border border-purple-400/20 dark:border-purple-500/30">
                  <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-lg text-slate-700 dark:text-slate-200">{t.welcome}</p>
                <p className="text-sm mt-2 text-slate-500 dark:text-slate-400">{t.hint}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
              >
                <div
                  className={`max-w-[85%] p-4 leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600/80 to-indigo-600/80 dark:from-purple-600/90 dark:to-indigo-600/90 backdrop-blur-md text-white ' +
                        (isRTL ? 'rounded-2xl rounded-tl-sm' : 'rounded-2xl rounded-tr-sm')
                      : 'bg-white/50 dark:bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/10 text-slate-700 dark:text-slate-200 ' +
                        (isRTL ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm')
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-2xl rounded-tl-sm bg-white/50 dark:bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 p-4 bg-slate-100/80 dark:bg-black/20 backdrop-blur-md border-t border-black/5 dark:border-white/10">
            <div className={`flex gap-2 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t.placeholder}
                className={`flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-0 border border-slate-300/50 dark:border-white/10 focus:border-purple-400/50 dark:focus:border-purple-400/50 ${isRTL ? 'text-right' : 'text-left'}`}
                disabled={isLoading}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-full transition-all shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:shadow-[0_0_20px_rgba(147,51,234,0.6)]"
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
