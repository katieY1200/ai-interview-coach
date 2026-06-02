import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChatBubble } from '../components/interview/ChatBubble';
import { AnswerInput } from '../components/interview/AnswerInput';
import { BehaviorWarningBanner } from '../components/interview/BehaviorWarningBanner';
import { WebcamPreview } from '../components/interview/WebcamPreview';
import { useBehaviorAnalysis } from '../hooks/useBehaviorAnalysis';
import { useVideoRecording } from '../hooks/useVideoRecording';
import { api } from '../services/api';
import type { ChatMessage, SessionStartResponse, Question } from '../types';

const toneLabel: Record<string, string> = {
  strict: '엄격한 면접관',
  neutral: '중립적 면접관',
  friendly: '친절한 면접관',
};

// 카메라 사용 불가 모달
function CameraUnavailableModal({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="text-3xl mb-3 text-center">📵</div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          카메라를 사용할 수 없습니다
        </h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
          카메라/마이크 접근이 거부됐거나 장치가 연결되지 않았습니다.
          <br />
          <br />
          <strong className="text-gray-700">챗봇과 음성으로 진행하시겠습니까?</strong>
          <br />
          <span className="text-xs text-gray-400">
            (태도 분석 및 영상 녹화는 진행되지 않습니다)
          </span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            계속하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const initData = location.state as SessionStartResponse | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [tone, setTone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveRecording, setSaveRecording] = useState(false);

  // 스트림을 useState로 관리 → 변경 시 WebcamPreview 자동 리렌더
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraModal, setCameraModal] = useState(false);
  const [cameraDisabled, setCameraDisabled] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  // cleanup에서 stream 상태를 직접 읽으면 effect 클로저가 null을 캡처하므로 ref로 따로 보관
  const streamRef = useRef<MediaStream | null>(null);

  const behavior = useBehaviorAnalysis();
  const recorder = useVideoRecording();

  const getElapsed = useCallback(
    () => Math.floor((Date.now() - startTimeRef.current) / 1000),
    []
  );

  // 웹캠 초기화
  useEffect(() => {
    const stored = sessionStorage.getItem('interviewConfig');
    const config = stored ? JSON.parse(stored) : {};
    setSaveRecording(config.save_recording ?? false);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        streamRef.current = s;
        setStream(s);
        if (config.save_recording) recorder.startRecording(s);
      })
      .catch(() => {
        setCameraModal(true);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 행동 분석 시작 - MediaPipe 모델 로딩(isReady)이 완료되고 스트림이 붙은 후에야 시작
  useEffect(() => {
    if (!behavior.isReady || !videoRef.current || !stream || cameraDisabled) return;
    behavior.startAnalysis(videoRef.current, getElapsed);
    return () => behavior.stopAnalysis();
    // startAnalysis/stopAnalysis는 useCallback이라 레퍼런스가 안 바뀌므로 deps에서 생략
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behavior.isReady, stream, cameraDisabled]);

  // 경고 백엔드 저장
  useEffect(() => {
    if (!behavior.currentWarning || !sessionId) return;
    api.sessions
      .addWarning({
        session_id: sessionId,
        warning_type: behavior.currentWarning.type,
        warning_label: behavior.currentWarning.label,
        timestamp_seconds: behavior.currentWarning.timestamp,
      })
      .catch(() => {});
  }, [behavior.currentWarning]);

  // 첫 질문 세팅
  // TODO: 면접 시작 전 카운트다운(3-2-1) 추가하면 실전감이 높아질 것 같다
  useEffect(() => {
    if (!initData || !sessionId) return;
    setTone(initData.interviewer_tone);
    setTotalQuestions(initData.total_questions);
    setCurrentQuestion(initData.first_question);
    startTimeRef.current = Date.now();

    setMessages([
      {
        id: 'intro',
        role: 'ai',
        text: `안녕하세요. 오늘 면접을 진행할 ${toneLabel[initData.interviewer_tone] || '면접관'}입니다. 총 ${initData.total_questions}개의 질문을 준비했습니다. 편안하게 답변해 주세요.`,
      },
      {
        id: `q-${initData.first_question.id}`,
        role: 'ai',
        text: initData.first_question.question_text,
        questionType: initData.first_question.question_type,
        questionId: initData.first_question.id,
      },
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCameraModalContinue = () => {
    setCameraModal(false);
    setCameraDisabled(true);
  };

  const handleCameraModalCancel = () => {
    stream?.getTracks().forEach((t) => t.stop());
    navigate('/onboarding');
  };

  const addTypingIndicator = () => {
    const id = `typing-${Date.now()}`;
    setMessages((prev) => [...prev, { id, role: 'ai', text: '', isTyping: true }]);
    return id;
  };

  const handleAnswer = async (text: string, duration: number) => {
    if (!currentQuestion || !sessionId || loading) return;
    setLoading(true);

    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'user', text, duration }]);
    setAnsweredCount((c) => c + 1);

    const typingId = addTypingIndicator();

    try {
      const res = await api.sessions.answer({
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: text,
        answer_duration: duration,
      });

      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      if (res.is_complete) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'complete',
            role: 'ai',
            text: '모든 질문이 끝났습니다. 수고 많으셨습니다. 잠시 후 결과를 분석합니다...',
          },
        ]);
        setCurrentQuestion(null);
        behavior.stopAnalysis();
        if (recorder.isRecording) recorder.stopRecording();

        const result = await api.sessions.complete(sessionId);
        navigate(`/results/${sessionId}`, {
          state: { ...result, hasRecording: saveRecording && !cameraDisabled },
        });
      } else if (res.next_question) {
        setCurrentQuestion(res.next_question);
        const msgs: ChatMessage[] = [];
        if (res.followup_reason) {
          msgs.push({
            id: `hint-${Date.now()}`,
            role: 'ai',
            text: '조금 더 구체적으로 여쭤볼게요.',
          });
        }
        msgs.push({
          id: `q-${res.next_question.id}`,
          role: 'ai',
          text: res.next_question.question_text,
          questionType: res.next_question.question_type,
          questionId: res.next_question.id,
        });
        setMessages((prev) => [...prev, ...msgs]);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== typingId));
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'ai',
          text: '오류가 발생했습니다. 다시 시도해 주세요.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 카메라 불가 모달 */}
      {cameraModal && (
        <CameraUnavailableModal
          onContinue={handleCameraModalContinue}
          onCancel={handleCameraModalCancel}
        />
      )}

      {/* 실시간 경고 배너 */}
      <BehaviorWarningBanner
        warning={
          behavior.currentWarning
            ? { label: behavior.currentWarning.label, type: behavior.currentWarning.type }
            : null
        }
      />

      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-emerald-600">면까알</span>
          {tone && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {toneLabel[tone] || tone}
            </span>
          )}
          {cameraDisabled && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              카메라 없음
            </span>
          )}
          {recorder.isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              녹화 중
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {currentQuestion && `${answeredCount + 1} / ${totalQuestions}`}
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 웹캠 PIP (카메라 사용 가능할 때만) */}
        {!cameraDisabled && (
          <div className="fixed bottom-28 right-4 z-20">
            <WebcamPreview
              ref={videoRef}
              stream={stream}
              isRecording={recorder.isRecording}
              isAnalysisReady={behavior.isReady}
              isAnalysisLoading={behavior.isLoading}
            />
          </div>
        )}
      </div>

      {/* 답변 입력 */}
      {currentQuestion && (
        <div className="sticky bottom-0 max-w-2xl w-full mx-auto">
          <AnswerInput onSubmit={handleAnswer} disabled={loading} />
        </div>
      )}
    </div>
  );
}
