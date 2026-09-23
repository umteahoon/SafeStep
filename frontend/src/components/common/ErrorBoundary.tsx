import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 한 화면에서 예상치 못한 에러(예: 외부 스크립트 로드 실패)가 나도 앱 전체가
 * 하얗게 날아가지 않도록 감싸는 최상위 안전망. 라우트가 바뀌면 자동으로 복구됩니다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[SafeStep] 처리되지 않은 화면 오류:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
          <p className="text-lg font-bold text-gray-900">문제가 발생했습니다</p>
          <p className="max-w-sm text-sm text-gray-500">
            화면을 불러오는 중 오류가 발생했습니다. 새로고침해도 계속되면 관리자에게
            알려주세요.
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.href = '/';
            }}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            처음으로 돌아가기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
