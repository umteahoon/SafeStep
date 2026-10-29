import { Link } from 'react-router-dom';

/** 없는 주소로 들어왔을 때 안내 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-6xl font-extrabold text-blue-600">404</p>
      <h1 className="mt-4 text-xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-gray-500">주소가 바뀌었거나 삭제된 페이지입니다.</p>
      <div className="mt-6 flex gap-2">
        <Link to="/" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">홈으로</Link>
        <Link to="/map" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">지도 보기</Link>
      </div>
    </div>
  );
}
