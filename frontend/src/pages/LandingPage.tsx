import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';

function MemberModal({
  mode,
  onClose,
}: {
  mode: 'create' | 'login';
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await api.members.create();
      setNewCode(res.member_code);
      localStorage.setItem('memberCode', res.member_code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.members.verify(code.trim().toUpperCase());
      localStorage.setItem('memberCode', code.trim().toUpperCase());
      onClose();
      navigate('/history');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        {mode === 'create' ? (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-2">회원 코드 발급</h3>
            <p className="text-sm text-gray-500 mb-4">
              코드를 발급받으면 이전 면접 기록을 언제든지 열람할 수 있습니다.
              <br />
              <strong className="text-amber-600">코드를 잃어버리면 복구가 불가능합니다!</strong>
            </p>

            {!newCode ? (
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? '발급 중...' : '코드 발급받기'}
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">나의 회원 코드</p>
                <div className="font-mono text-3xl font-bold text-emerald-600 tracking-widest mb-3">
                  {newCode}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mb-4"
                  onClick={() => navigator.clipboard.writeText(newCode)}
                >
                  복사하기
                </Button>
                <p className="text-xs text-gray-400 mb-4">
                  안전한 곳에 저장해 주세요.
                </p>
                <Button className="w-full" onClick={onClose}>
                  확인
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-2">코드로 로그인</h3>
            <p className="text-sm text-gray-500 mb-4">
              발급받은 8자리 코드를 입력해 주세요.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="예: A3K9P2XM"
              maxLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 font-mono text-center text-xl tracking-widest mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <Button className="w-full" onClick={handleLogin} disabled={loading || code.length < 8}>
              {loading ? '확인 중...' : '기록 보기'}
            </Button>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<'create' | 'login' | null>(null);
  const storedCode = localStorage.getItem('memberCode');

  const steps = [
    {
      icon: '📝',
      title: '자기소개서 입력',
      desc: '자기소개서를 붙여넣으면 AI가 예상 질문을 생성합니다.',
    },
    {
      icon: '🎤',
      title: '실시간 모의 면접',
      desc: '음성 또는 텍스트로 답변하며 면접 분위기를 체험합니다.',
    },
    {
      icon: '📊',
      title: '종합 피드백',
      desc: '점수, 잘한 점, 보완 포인트를 한눈에 확인합니다.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {modal && (
        <MemberModal mode={modal} onClose={() => setModal(null)} />
      )}

      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-xl font-bold text-emerald-600">면까알</span>
        <div className="flex gap-2">
          {storedCode ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              기록 보기 ({storedCode})
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setModal('login')}>
                로그인
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setModal('create')}>
                코드 발급
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 text-center max-w-2xl mx-auto">
        <div className="inline-block bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          AI 면접 코치
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-4">
          면까몰?<br />
          <span className="text-emerald-600">면까알!</span>
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-8">
          면접 까보기 전에 몰라?<br />
          <strong className="text-gray-700">면접 까보기 전에도 알아!</strong>
        </p>
        <p className="text-base text-gray-500 mb-10">
          스터디 없이 혼자 준비해도 괜찮아요.<br />
          자기소개서 기반 예상 질문부터 실시간 태도 피드백까지,<br />
          AI가 객관적으로 면접을 평가해 드립니다.
        </p>
        <Button size="lg" onClick={() => navigate('/onboarding')} className="px-10">
          지금 바로 시작하기 →
        </Button>
        <p className="text-sm text-gray-400 mt-3">로그인 없이 바로 사용 가능</p>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            이렇게 진행됩니다
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <div className="text-4xl mb-3">{s.icon}</div>
                <div className="text-xs font-bold text-emerald-600 mb-1">STEP {i + 1}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">주요 기능</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: '🤖', title: 'AI 예상 질문 생성', desc: '자기소개서 분석 + 기업 유형별 인성 질문' },
            { icon: '↪️', title: '꼬리질문 자동 생성', desc: '답변이 모호하면 AI가 더 파고듭니다' },
            { icon: '⚠️', title: '실시간 태도 피드백', desc: '시선 이탈, 과도한 움직임 즉시 경고' },
            { icon: '⏱', title: '답변 시간 관리', desc: '1분 권장, 2분 초과 시 경고' },
            { icon: '🎲', title: '면접관 어조 랜덤', desc: '엄격 / 중립 / 친절 — 어떤 면접관이 올지 모르니까' },
            { icon: '🔒', title: '개인정보 보호', desc: '영상은 다운로드 즉시 서버 삭제' },
          ].map((f, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl border border-gray-200">
              <span className="text-2xl shrink-0">{f.icon}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                <p className="text-gray-500 text-sm mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-600 py-16 px-6 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">지금 바로 면접 준비를 시작해 보세요</h2>
        <p className="text-emerald-100 mb-6">로그인 없이, 무료로 사용할 수 있습니다.</p>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => navigate('/onboarding')}
          className="!text-emerald-700 !border-white"
        >
          면접 시작하기 →
        </Button>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-400">
        면까알 · 혼자서도 완벽하게
      </footer>
    </div>
  );
}
