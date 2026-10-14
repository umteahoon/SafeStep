import { useEffect, useState } from 'react';
import type { SidoGroup } from '../../lib/region';

export interface RegionValue {
  sido: string | null;
  sigungu: string | null;
}

/**
 * 지역 선택 바텀시트 — 왼쪽에서 시/도, 오른쪽에서 구/시를 고르는 2단 구조.
 * 모바일 앱 components/RegionSheet.tsx와 동일한 동작을 웹으로 포팅.
 */
export function RegionSheet({
  visible,
  groups,
  value,
  onSelect,
  onClose,
  unit = '스터디카페',
}: {
  visible: boolean;
  groups: SidoGroup[];
  value: RegionValue;
  onSelect: (v: RegionValue) => void;
  onClose: () => void;
  unit?: string;
}) {
  // 시트 안에서 둘러보는 시/도 — 왼쪽 목록을 눌러도 선택이 적용되지 않고 오른쪽 구/시 목록만 바뀜
  const [browse, setBrowse] = useState<string | null>(value.sido);
  useEffect(() => {
    if (visible) setBrowse(value.sido);
  }, [visible, value.sido]);

  if (!visible) return null;
  const active = groups.find((g) => g.sido === browse) ?? groups[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
      <div className="relative flex h-[62vh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-6">
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-gray-300" />
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-extrabold text-gray-900">지역 선택</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="닫기">
            ✕
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">선택할 수 있는 지역이 없어요</p>
        ) : (
          <div className="flex flex-1 overflow-hidden border-t border-gray-100">
            {/* 시/도 */}
            <div className="w-[118px] shrink-0 overflow-y-auto bg-gray-50">
              {groups.map((g) => {
                const on = g.sido === active?.sido;
                return (
                  <button
                    key={g.sido}
                    onClick={() => setBrowse(g.sido)}
                    className={`flex w-full items-center justify-between px-4 py-4 text-left ${on ? 'bg-white' : ''}`}
                  >
                    <span className={`text-sm ${on ? 'font-extrabold text-gray-900' : 'font-medium text-gray-500'}`}>
                      {g.sido}
                    </span>
                    <span className={`text-xs font-semibold ${on ? 'text-blue-600' : 'text-gray-400'}`}>{g.count}</span>
                  </button>
                );
              })}
            </div>
            {/* 구/시 */}
            <div className="flex-1 overflow-y-auto">
              {[{ name: '__all__', count: active?.count ?? 0 }, ...(active?.districts ?? [])].map((d) => {
                const isAll = d.name === '__all__';
                const on =
                  value.sido === active?.sido && (isAll ? !value.sigungu : value.sigungu === d.name);
                return (
                  <button
                    key={d.name}
                    onClick={() => active && onSelect({ sido: active.sido, sigungu: isAll ? null : d.name })}
                    className="flex w-full items-center justify-between border-b border-gray-100 px-5 py-3.5 text-left"
                  >
                    <div>
                      <p className={`text-sm ${on ? 'font-extrabold text-blue-600' : 'font-medium text-gray-900'}`}>
                        {isAll ? `${active?.sido} 전체` : d.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {unit} {d.count}곳
                      </p>
                    </div>
                    {on && <span className="text-blue-600">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => onSelect({ sido: null, sigungu: null })}
          className="mx-auto mt-3 px-4 py-2 text-xs font-bold text-gray-500 underline"
        >
          전체 지역 보기
        </button>
      </div>
    </div>
  );
}
