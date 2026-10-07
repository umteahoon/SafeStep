// 네이티브 모듈 모킹 (jest 환경에는 네이티브 코드가 없음)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: async () => ({ isConnected: true }), addEventListener: () => () => {} },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 37.5665, longitude: 126.978 } }),
}));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('expo-linking', () => ({ createURL: () => 'exp://localhost/', useURL: () => null }));
