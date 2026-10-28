import { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import type { MapFrameHandle, MapFrameProps } from './MapFrame';

export type { MapFrameHandle, MapFrameProps } from './MapFrame';

// 지도 HTML은 WebView 안에서 window.ReactNativeWebView.postMessage 로 앱에 메시지를 보냅니다.
// 웹에서는 같은 이름의 객체를 만들어 부모 창(앱)으로 전달하도록 맞춰 줍니다.
const BRIDGE =
  '<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage({__safestepMap:true,data:d},"*");}};</script>';

/**
 * 웹(react-native-web)용 지도 틀: WebView 대신 같은 사이트의 public/map-frame.html 을 iframe 으로 열고,
 * 준비되면 지도 HTML을 넘겨 그 안에 그리게 합니다. (주소가 https 그대로라 네이버 지도 스크립트가 정상 동작)
 */
export const MapFrame = forwardRef<MapFrameHandle, MapFrameProps>(function MapFrame({ html, onMessage, style }, ref) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const doc = useMemo(() => html.replace('<head>', '<head>' + BRIDGE), [html]);
  const docRef = useRef(doc);
  docRef.current = doc;

  useImperativeHandle(ref, () => ({
    postMessage: (data) => frameRef.current?.contentWindow?.postMessage(data, '*'),
  }), []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const win = frameRef.current?.contentWindow;
      if (!win || e.source !== win) return;
      const m = e.data as { __safestepMap?: boolean; __safestepMapFrameReady?: boolean; data?: string } | null;
      if (!m) return;
      if (m.__safestepMapFrameReady) win.postMessage({ __safestepMapHtml: docRef.current }, '*');
      else if (m.__safestepMap && typeof m.data === 'string') onMessageRef.current(m.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <View style={[{ flex: 1 }, style]}>
      {createElement('iframe', {
        ref: frameRef,
        src: '/map-frame.html',
        title: '지도',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
});
