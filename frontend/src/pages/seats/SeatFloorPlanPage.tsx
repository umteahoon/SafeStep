import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { FloorPlanGrid } from '../../components/seat/FloorPlanGrid';
import { NoiseReportModal } from '../../components/seat/NoiseReportModal';
import type { Academy, Seat } from '../../types';

export default function SeatFloorPlanPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [reportSeat, setReportSeat] = useState<Seat | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('academies')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setAcademy(data as Academy));
  }, [id]);

  if (!id) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <button
            onClick={() => navigate('/map')}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← 지도로 돌아가기
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {academy?.name ?? '좌석 도면'}
          </h1>
          {academy && <p className="text-sm text-gray-400">{academy.address}</p>}
        </div>
        <button
          onClick={() => navigate(`/kiosk?academy=${id}`)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          키오스크로 입/퇴실하기
        </button>
      </header>

      <FloorPlanGrid academyId={id} onSelectSeat={(seat) => setReportSeat(seat)} />

      {reportSeat && (
        <NoiseReportModal seat={reportSeat} onClose={() => setReportSeat(null)} />
      )}
    </div>
  );
}
