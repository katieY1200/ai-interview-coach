import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import type { CompanyType, JobCategory, InterviewMode } from '../types';

const JOB_CATEGORIES: JobCategory[] = ['개발', '디자인', '기획', '마케팅', '영업', '인사'];

const STEPS = ['기업 유형', '직무', '면접 모드', '영상 저장', '자기소개서'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [companyType, setCompanyType] = useState<CompanyType>('large');
  const [jobCategory, setJobCategory] = useState<JobCategory>('개발');
  const [mode, setMode] = useState<InterviewMode>('normal');
  const [saveRecording, setSaveRecording] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const memberCode = localStorage.getItem('memberCode') || undefined;

  const canNext = () => {
    if (step === 4) return coverLetter.trim().length > 50;
    return true;
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');
    // InterviewPage에서 녹화 여부 읽기 위해 저장
    sessionStorage.setItem('interviewConfig', JSON.stringify({ save_recording: saveRecording }));
    try {
      const res = await api.sessions.start({
        company_type: companyType,
        job_category: jobCategory,
        mode,
        save_recording: saveRecording,
        cover_letter: coverLetter,
        member_code: memberCode,
      });
      navigate(`/interview/${res.session_id}`, { state: res });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <button onClick={() => navigate('/')} className="mb-8 text-2xl font-bold text-emerald-600">
        면까알
      </button>

      {/* Progress */}
      <div className="flex gap-2 mb-10">
        {STEPS.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i === step
                  ? 'bg-emerald-600 text-white'
                  : i < step
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">{label}</span>
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        {/* Step 0: Company type */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">어떤 기업에 지원하시나요?</h2>
            <p className="text-sm text-gray-500 mb-6">기업 유형에 따라 인성 질문이 달라집니다.</p>
            <div className="flex flex-col gap-3">
              {(['large', 'startup'] as CompanyType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setCompanyType(type)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    companyType === type
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {type === 'large' ? '대기업 / 중견기업' : '스타트업'}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {type === 'large'
                      ? '보수적이고 검증된 인성 면접 질문'
                      : '도전정신, 빠른 환경 적응 관련 질문'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Job category */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">지원 직무를 선택해 주세요.</h2>
            <p className="text-sm text-gray-500 mb-6">API 오류 시 직무별 예비 질문이 사용됩니다.</p>
            <div className="grid grid-cols-2 gap-3">
              {JOB_CATEGORIES.map((job) => (
                <button
                  key={job}
                  onClick={() => setJobCategory(job)}
                  className={`p-3 rounded-xl border-2 font-medium text-sm transition-colors ${
                    jobCategory === job
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {job}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Interview mode */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">면접 모드를 선택해 주세요.</h2>
            <p className="text-sm text-gray-500 mb-6">
              처음이라면 가벼운 모드를 추천드려요.
            </p>
            <div className="flex flex-col gap-3">
              {(['normal', 'light'] as InterviewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    mode === m
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {m === 'normal' ? '일반 모드' : '가벼운 모드'}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {m === 'normal'
                      ? '자소서 2문항 + 인성 2문항 + 꼬리질문 (최대 10문항)'
                      : '자소서 기반 3~4문항, 꼬리질문 없음'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Recording */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">면접 영상을 저장하시겠습니까?</h2>
            <p className="text-sm text-gray-500 mb-6">
              저장한 영상은 면접 종료 후 즉시 다운로드하실 수 있으며,<br />
              서버에는 보관되지 않습니다.
            </p>
            <div className="flex flex-col gap-3">
              {[false, true].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setSaveRecording(val)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    saveRecording === val
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {val ? '저장 후 다운로드' : '저장하지 않음'}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {val
                      ? '영상 녹화 → 면접 종료 시 다운로드 버튼 생성 → 서버 즉시 삭제'
                      : '텍스트 기록만 유지, 영상 미저장 (개인정보 보호)'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Cover letter */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">자기소개서를 붙여넣어 주세요.</h2>
            <p className="text-sm text-gray-500 mb-4">
              문항 제목과 답변을 포함하여 전체 내용을 붙여넣으세요.<br />
              AI가 문항을 분석하여 예상 질문을 생성합니다.
            </p>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder={'[지원 동기]\n저는 어릴 때부터...\n\n[성장 과정]\n...\n\n[직무 역량]\n...'}
              rows={10}
              className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">{coverLetter.length}자 (최소 50자)</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate('/') : setStep((s) => s - 1))}
          >
            {step === 0 ? '취소' : '← 이전'}
          </Button>

          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              다음 →
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={loading || !canNext()} size="lg">
              {loading ? '생성 중...' : '면접 시작 🚀'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
