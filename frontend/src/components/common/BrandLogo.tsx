/** 상단 바 · 사이드바용 로고 (계단 아이콘 + SafeStep 글자). 작은 크기에서도 읽히도록 이미지 대신 벡터 + 텍스트 */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#2563EB" />
        <path
          d="M13 47h13V35h13V23h12"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="51" cy="14" r="4.5" fill="#fff" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-gray-900">
        Safe<span className="text-blue-600">Step</span>
      </span>
    </span>
  );
}
