import { Alert } from 'react-native';

/** 웹의 window.confirm 대체. 확인을 누르면 true. */
export function confirmAsync(
  title: string,
  message?: string,
  okText = '확인',
  destructive = true
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: okText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
