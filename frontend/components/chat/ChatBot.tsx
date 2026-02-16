'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';

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

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const chatUrl = `${apiBase.replace(/\/$/, '')}/api/chat`;
    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          locale
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || data.detail || t.error);
      const reply = data.response || data.detail || t.error;

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: t.error }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 z-50 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Modal */}
      {isOpen && (
        <div
          className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-50 w-[90vw] max-w-[400px] h-[550px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col overflow-hidden`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 flex items-center justify-between">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <h3 className="text-white font-semibold">{t.title}</h3>
                <p className="text-white/70 text-sm">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700">
            {messages.length === 0 && (
              <div className={`text-center text-gray-400 mt-8 ${isRTL ? 'text-right' : ''}`}>
                <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-lg">{t.welcome}</p>
                <p className="text-sm mt-2 text-gray-500">{t.hint}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-100 border border-gray-700/50'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span className="text-gray-400 text-sm">...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700/50 bg-gray-800/50">
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t.placeholder}
                className={`flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-gray-500 border border-gray-700/50 ${isRTL ? 'text-right' : 'text-left'}`}
                disabled={isLoading}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
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
