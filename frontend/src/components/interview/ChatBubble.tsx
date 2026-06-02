import type { ChatMessage } from '../../types';

const typeLabel: Record<string, string> = {
  cover_letter: '자소서',
  personality: '인성',
  followup: '꼬리질문',
};

export function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'ai') {
    return (
      <div className="flex items-start gap-3 max-w-2xl">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
          AI
        </div>
        <div className="flex flex-col gap-1">
          {message.questionType && (
            <span className="text-xs text-emerald-600 font-medium">
              {typeLabel[message.questionType] || message.questionType}
            </span>
          )}
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-800 text-sm leading-relaxed">
            {message.isTyping ? (
              <span className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            ) : (
              message.text
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 max-w-2xl ml-auto flex-row-reverse">
      <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        나
      </div>
      <div className="flex flex-col gap-1 items-end">
        {message.duration !== undefined && (
          <span className="text-xs text-gray-400">
            {Math.floor(message.duration / 60)}분 {message.duration % 60}초
          </span>
        )}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tr-sm px-4 py-3 text-gray-800 text-sm leading-relaxed">
          {message.text}
        </div>
      </div>
    </div>
  );
}
