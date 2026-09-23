import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNaverMaps } from '../../hooks/useNaverMaps';
import { supabase } from '../../lib/supabase';
import { isNativeApp } from '../../lib/platform';
import logo from '../../assets/logo.png';
import type { Academy } from '../../types';

interface AcademyWithSeats extends Academy {
  emptySeats: number;
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청 (위치 권한 거부 시 기본값)

export default function MapSearchPage() {
  const navigate = useNavigate();
  const { isLoaded, error: mapError } = useNaverMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [academies, setAcademies] = useState<AcademyWithSeats[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [searchQuery, setSearchQuery] = useState('');

  // 사용자 위치
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* 권한 거부 시 기본 좌표 유지 */
      },
      { timeout: 5000 }
    );
  }, []);

  // 학원/카페 + 잔여석 로드
  useEffect(() => {
    async function load() {
      setIsLoadingList(true);
      const { data: academyRows, error: academyError } = await supabase
        .from('academies')
        .select('*');

      if (academyError || !academyRows) {
        setIsLoadingList(false);
        return;
      }

      const { data: seatRows } = await supabase
        .from('seats')
        .select('academy_id, status');

      const withSeats: AcademyWithSeats[] = academyRows.map((a: Academy) => {
        const emptySeats =
          seatRows?.filter((s) => s.academy_id === a.id && s.status === 'EMPTY')
            .length ?? 0;
        return { ...a, emptySeats };
      });

      setAcademies(withSeats);
      setIsLoadingList(false);
    }
    load();

    // 좌석 상태 실시간 반영
    const channel = supabase
      .channel('seats-map-overview')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats' },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom: 14,
    });
  }, [isLoaded, center]);

  // 마커 렌더링
  useEffect(() => {
    if (!isLoaded || !mapInstance.current) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    academies.forEach((academy) => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(academy.latitude, academy.longitude),
        map: mapInstance.current,
        title: academy.name,
      });

      const infoWindow = new window.naver.maps.InfoWindow({
        content: `<div style="padding:8px 12px;font-size:13px;">
          <strong>${academy.name}</strong><br/>
          잔여석 ${academy.emptySeats}석
        </div>`,
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
        infoWindow.open(mapInstance.current, marker);
      });

      markersRef.current.push(marker);
    });
  }, [isLoaded, academies]);

  const filteredAcademies = academies.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q);
  });

  const focusAcademy = (academy: AcademyWithSeats) => {
    if (!mapInstance.current || !window.naver) return;
    const position = new window.naver.maps.LatLng(academy.latitude, academy.longitude);
    mapInstance.current.panTo(position);
    mapInstance.current.setZoom(16);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredAcademies.length > 0) focusAcademy(filteredAcademies[0]);
  };

  return (
    <div className={`flex flex-col ${isNativeApp ? 'h-full' : 'h-screen'}`}>
      {!isNativeApp && (
        <header className="flex items-center border-b border-gray-100 px-6 py-3">
          <Link to="/">
            <img src={logo} alt="SafeStep" className="h-7 w-auto" />
          </Link>
        </header>
      )}

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <div className="relative h-1/2 w-full md:h-full md:w-2/3">
        {mapError && (
          <div className="flex h-full items-center justify-center bg-gray-50 p-6 text-center text-sm text-red-500">
            {mapError}
          </div>
        )}
        {!mapError && !isLoaded && (
          <div className="flex h-full items-center justify-center text-gray-400">
            지도를 불러오는 중...
          </div>
        )}
        <div ref={mapRef} className="h-full w-full" />
      </div>

      <div className="h-1/2 w-full overflow-y-auto border-l border-gray-200 md:h-full md:w-1/3">
        <div className="border-b border-gray-100 p-4">
          <h1 className="text-lg font-bold text-gray-900">주변 스터디카페 · 학원</h1>
          <p className="text-sm text-gray-400">실시간 잔여석을 확인하고 입장하세요</p>
          <form onSubmit={submitSearch} className="mt-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="지점명 또는 주소로 검색"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </form>
        </div>

        {isLoadingList && (
          <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
        )}

        <ul className="divide-y divide-gray-100">
          {filteredAcademies.map((a) => (
            <li
              key={a.id}
              className="cursor-pointer p-4 transition hover:bg-gray-50"
              onClick={() => navigate(`/seats/${a.id}`)}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{a.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.emptySeats > 0
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  잔여 {a.emptySeats}석 / {a.total_seats}석
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-400">{a.address}</p>
            </li>
          ))}
          {!isLoadingList && academies.length === 0 && (
            <li className="p-4 text-sm text-gray-400">등록된 지점이 없습니다.</li>
          )}
          {!isLoadingList && academies.length > 0 && filteredAcademies.length === 0 && (
            <li className="p-4 text-sm text-gray-400">"{searchQuery}"와 일치하는 지점이 없습니다.</li>
          )}
        </ul>
      </div>
      </div>
    </div>
  );
}
