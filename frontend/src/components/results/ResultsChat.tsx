import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '점수가 왜 이렇게 나왔나요?',
  '어떻게 개선할 수 있을까요?',
  '면접 팁을 알려주세요',
  '모범 답안이 있나요?',
];

export function ResultsChat({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '안녕하세요! 면접 결과에 대해 궁금한 점이 있으시면 무엇이든 물어보세요. 점수 이유, 개선 방법, 면접 팁, 모범 답안도 알려드릴게요 😊',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setMessages((prev) => [...prev, { role: 'assistant', content: '__typing__' } as Message]);

    try {
      // 시스템 첫 메시지 제외한 대화 히스토리 전달
      const history = messages
        .filter((_, i) => i > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.sessions.chat(sessionId, {
        message: text,
        history,
      });

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.content !== '__typing__');
        return [...filtered, { role: 'assistant', content: res.reply }];
      });
    } catch {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.content !== '__typing__');
        return [
          ...filtered,
          { role: 'assistant', content: '죄송합니다, 오류가 발생했습니다. 다시 시도해 주세요.' },
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
          AI
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">면접 코치</p>
          <p className="text-xs text-gray-400">결과에 대해 무엇이든 질문하세요</p>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="h-72 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                AI
              </div>
            )}
            <div
              className={`max-w-xs rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-emerald-50 border border-emerald-200 text-gray-800 rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}
            >
              {msg.content === '__typing__' ? (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 추천 질문 칩 (첫 메시지만) */}
      {messages.length === 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1.5 hover:bg-emerald-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="px-4 pb-4 flex gap-2 border-t border-gray-100 pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="질문을 입력하세요..."
          disabled={loading}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-50"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
