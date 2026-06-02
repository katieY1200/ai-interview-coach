import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ResultsChat } from '../components/results/ResultsChat';
import { recordingStore } from '../services/recordingStore';
import { api } from '../services/api';
import type { SessionResult, AnswerAnalysis } from '../types';

const levelStyle: Record<string, string> = {
  good: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  danger: 'bg-red-50 border-red-200 text-red-800',
};

const levelIcon: Record<string, string> = {
  good: '✅',
  warning: '⚠️',
  danger: '🔴',
};

const companyLabel: Record<string, string> = { large: '대기업/중견', startup: '스타트업' };

function ScoreCircle({ score }: { score: number | null }) {
  if (score === null) return <div className="text-gray-400 text-lg">분석 오류</div>;
  const color = score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className={`text-7xl font-bold ${color}`}>
      {score}
      <span className="text-3xl text-gray-400">점</span>
    </div>
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const locationState = location.state as (SessionResult & { hasRecording?: boolean }) | null;
  const [result, setResult] = useState<SessionResult | null>(locationState || null);
  const [loading, setLoading] = useState(!result);
  const [copied, setCopied] = useState(false);
  // hasRecording: 네비게이션 state 플래그 + recordingStore에 실제 blob 있는지 둘 다 확인
  const hasRecording = (locationState?.hasRecording ?? false) && !!recordingStore.get();

  const handleDownload = useCallback(() => {
    const url = recordingStore.consume();
    if (!url) return;
    const date = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `면까알_면접_${date}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);

  useEffect(() => {
    if (result || !sessionId) return;
    api.sessions.getResult(sessionId)
      .then(setResult)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleCopy = () => {
    if (!result) return;
    const lines = [
      `===== 면까알 면접 결과 =====`,
      `날짜: ${new Date(result.created_at).toLocaleString('ko-KR')}`,
      `기업 유형: ${companyLabel[result.company_type] || result.company_type}`,
      `직무: ${result.job_category}`,
      `모드: ${result.mode === 'normal' ? '일반' : '가벼운 모드'}`,
      `종합 점수: ${result.score ?? '없음'}점`,
      ``,
      `[잘한 점]`,
      ...(result.strengths || []).map((s) => `• ${s}`),
      ``,
      `[보완 포인트]`,
      ...(result.improvements || []).map((i) => `• ${i}`),
      ``,
      `[태도 피드백]`,
      result.attitude_summary || '-',
      ``,
      `[Q&A 분석]`,
      ...(result.answer_analysis || []).map(
        (a: AnswerAnalysis) => `Q: ${a.question}\n→ ${a.feedback} [${a.level}]`
      ),
      ``,
      `[태도 경고 기록]`,
      result.warnings.length
        ? result.warnings.map((w) => `• ${w.warning_label} (${w.timestamp_seconds}초)`).join('\n')
        : '없음',
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">결과를 분석하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">결과를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-xl font-bold text-emerald-600">
            면까알
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? '✅ 복사됨' : '📋 결과 복사'}
            </Button>
            <Button size="sm" onClick={() => navigate('/onboarding')}>
              다시 시작
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Score */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500 mb-3">종합 점수</p>
          <ScoreCircle score={result.score} />
          <div className="mt-4 flex justify-center gap-3 text-xs text-gray-500">
            <span>{companyLabel[result.company_type] || result.company_type}</span>
            <span>·</span>
            <span>{result.job_category}</span>
            <span>·</span>
            <span>{result.mode === 'normal' ? '일반 모드' : '가벼운 모드'}</span>
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-1.5">
              <span>✅</span> 잘한 점
            </h3>
            <ul className="flex flex-col gap-2">
              {(result.strengths || []).map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-emerald-500 shrink-0">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-amber-600 mb-3 flex items-center gap-1.5">
              <span>📌</span> 보완 포인트
            </h3>
            <ul className="flex flex-col gap-2">
              {(result.improvements || []).map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-amber-400 shrink-0">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Attitude summary */}
        {result.attitude_summary && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">태도 피드백</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{result.attitude_summary}</p>
          </div>
        )}

        {/* Answer analysis */}
        {result.answer_analysis && result.answer_analysis.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">답변별 분석</h3>
            <div className="flex flex-col gap-3">
              {result.answer_analysis.map((a: AnswerAnalysis, i: number) => (
                <div key={i} className={`border rounded-xl p-3.5 ${levelStyle[a.level] || ''}`}>
                  <div className="flex items-start gap-2">
                    <span>{levelIcon[a.level] || ''}</span>
                    <div>
                      <p className="text-xs font-semibold mb-1">{a.question}</p>
                      <p className="text-sm leading-relaxed">{a.feedback}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning log */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">태도 경고 기록</h3>
          {result.warnings.length === 0 ? (
            <p className="text-sm text-emerald-600">경고 없음 👍</p>
          ) : (
            <div className="flex flex-col gap-2">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-amber-500">⚠️</span>
                  <span className="text-gray-700">{w.warning_label}</span>
                  <span className="text-gray-400 text-xs ml-auto">
                    {Math.floor(w.timestamp_seconds / 60)}분 {w.timestamp_seconds % 60}초
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 면접 코치 채팅 */}
        <ResultsChat sessionId={result.session_id} />

        {/* Bottom actions */}
        <div className="flex flex-col gap-3 pb-8">
          {/* 영상 다운로드 (저장 모드였을 때만) */}
          {hasRecording && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-800 text-sm">면접 영상이 준비됐습니다</p>
                <p className="text-xs text-emerald-600 mt-0.5">다운로드 후 서버에서 즉시 삭제됩니다</p>
              </div>
              <Button variant="primary" size="sm" onClick={handleDownload}>
                📥 영상 다운로드
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/onboarding')}>
              다시 시작
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleCopy}>
              {copied ? '✅ 복사됨' : '📋 결과 복사하기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
