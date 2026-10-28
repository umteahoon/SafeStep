import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapFrameHandle {
  postMessage: (data: string) => void;
}

export interface MapFrameProps {
  html: string;
  /** 네이버 지도처럼 등록된 도메인에서만 열리는 지도를 위한 기준 주소 (네이티브 전용) */
  baseUrl?: string;
  onMessage: (data: string) => void;
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * 지도 HTML을 띄우는 틀 (네이티브: WebView).
 * 웹(react-native-web)에서는 WebView가 동작하지 않으므로 MapFrame.web.tsx 의 iframe 구현이 대신 쓰입니다.
 */
export const MapFrame = forwardRef<MapFrameHandle, MapFrameProps>(function MapFrame(
  { html, baseUrl, onMessage, onError, style },
  ref
) {
  const webRef = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({ postMessage: (data) => webRef.current?.postMessage(data) }), []);
  return (
    <WebView
      ref={webRef}
      style={style}
      originWhitelist={['*']}
      source={baseUrl ? { html, baseUrl } : { html }}
      javaScriptEnabled
      onMessage={(e) => onMessage(e.nativeEvent.data)}
      onError={onError}
    />
  );
});
