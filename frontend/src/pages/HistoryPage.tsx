import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import type { HistoryItem } from '../types';

const companyLabel: Record<string, string> = { large: '대기업/중견', startup: '스타트업' };

export default function HistoryPage() {
  const navigate = useNavigate();
  const memberCode = localStorage.getItem('memberCode');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!memberCode) { setLoading(false); return; }
    api.sessions.getHistory(memberCode)
      .then(setHistory)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [memberCode]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-xl font-bold text-emerald-600">
            면까알
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600 font-medium">면접 기록</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {!memberCode && (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">로그인이 필요합니다.</p>
            <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
          </div>
        )}

        {memberCode && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-gray-900">나의 면접 기록</h1>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-mono">
                {memberCode}
              </span>
            </div>

            {loading && (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {!loading && !error && history.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-400 mb-4">아직 면접 기록이 없습니다.</p>
                <Button onClick={() => navigate('/onboarding')}>첫 면접 시작하기</Button>
              </div>
            )}

            {!loading && history.length > 0 && (
              <div className="flex flex-col gap-3">
                {history.map((item) => (
                  <button
                    key={item.session_id}
                    onClick={() => navigate(`/results/${item.session_id}`)}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-left hover:border-emerald-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {companyLabel[item.company_type] || item.company_type}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-sm text-gray-600">{item.job_category}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {item.mode === 'normal' ? '일반' : '가벼운'}
                        </span>
                      </div>
                      {item.score !== null && (
                        <span
                          className={`text-lg font-bold ${
                            item.score >= 70
                              ? 'text-emerald-600'
                              : item.score >= 50
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {item.score}점
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString('ko-KR')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
