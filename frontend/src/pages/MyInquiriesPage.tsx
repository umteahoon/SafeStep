import { useEffect, useState } from 'react';
import { PublicHeader } from '../components/common/PublicHeader';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Inquiry } from '../types';

export default function MyInquiriesPage() {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('inquiries')
      .select('*')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInquiries((data as Inquiry[]) ?? []);
        setIsLoading(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">내 문의 내역</h1>
        <p className="mt-1 text-sm text-gray-500">
          로그인 상태로 남긴 "학원·카페 도입 문의"만 표시됩니다.
        </p>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white">
          {isLoading ? (
            <p className="p-6 text-sm text-gray-400">불러오는 중...</p>
          ) : inquiries.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">아직 남긴 문의가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {inquiries.map((q) => (
                <li key={q.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {q.business_name || q.business_type || '문의'}
                    </p>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                      접수됨
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(q.created_at).toLocaleString()}
                  </p>
                  {q.message && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{q.message}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
