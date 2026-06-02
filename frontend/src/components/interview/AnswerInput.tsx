import { useState, useEffect } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useTimer, formatTime } from '../../hooks/useTimer';
import { Button } from '../ui/Button';

interface Props {
  onSubmit: (text: string, duration: number) => void;
  disabled?: boolean;
}

export function AnswerInput({ onSubmit, disabled }: Props) {
  const [textValue, setTextValue] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const { transcript, isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition();
  const timer = useTimer();

  useEffect(() => {
    if (mode === 'voice') setTextValue(transcript);
  }, [transcript, mode]);

  const handleStartVoice = () => {
    setTextValue('');
    startListening();
    timer.start();
  };

  const handleStopVoice = () => {
    stopListening();
    timer.stop();
  };

  const handleSubmit = () => {
    const text = textValue.trim();
    if (!text) return;
    onSubmit(text, timer.seconds);
    setTextValue('');
    timer.reset();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextValue(e.target.value);
    if (!timer.isRunning) timer.start();
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* Timer bar */}
      {timer.isRunning && (
        <div className={`flex items-center gap-2 mb-3 text-sm font-medium ${
          timer.isTooLong ? 'text-red-500' : timer.isWarning ? 'text-amber-500' : 'text-gray-500'
        }`}>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <span>{formatTime(timer.seconds)}</span>
          {timer.isTooLong && <span className="text-red-500 text-xs">답변이 너무 깁니다 (2분 초과)</span>}
          {timer.isWarning && !timer.isTooLong && <span className="text-amber-500 text-xs">1분 경과</span>}
        </div>
      )}

      {/* Mode toggle */}
      {isSupported && (
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setMode('text')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              mode === 'text'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            텍스트
          </button>
          <button
            onClick={() => setMode('voice')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              mode === 'voice'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            음성 인식
          </button>
        </div>
      )}

      {mode === 'voice' ? (
        <div className="flex flex-col gap-3">
          {textValue && (
            <div className="min-h-16 bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
              {textValue || <span className="text-gray-400">음성 인식 결과가 여기에 표시됩니다...</span>}
            </div>
          )}
          <div className="flex gap-2">
            {!isListening ? (
              <Button
                variant="primary"
                onClick={handleStartVoice}
                disabled={disabled}
                className="flex-1"
              >
                🎤 답변 시작
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={handleStopVoice}
                className="flex-1 animate-pulse"
              >
                ⏹ 답변 완료
              </Button>
            )}
            {textValue && !isListening && (
              <Button variant="primary" onClick={handleSubmit} disabled={disabled}>
                제출
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={textValue}
            onChange={handleTextChange}
            placeholder="답변을 입력하세요..."
            rows={3}
            disabled={disabled}
            className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Ctrl+Enter로 제출</span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || !textValue.trim()}
            >
              제출
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
