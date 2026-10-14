import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { PREVIEW_MODE, useAuth } from '../../lib/useAuth';
import { Banner, Button, Field, Input, Muted, Screen } from '../../components/ui';

/** 이름·연락처 수정. 이메일·역할·소속은 여기서 바꾸지 않습니다. */
export default function ProfileEditScreen() {
  const navigation = useNavigation();
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setError(null);
    if (!name.trim()) return setError('이름을 입력해 주세요.');
    setBusy(true);
    if (PREVIEW_MODE) {
      // 미리보기 모드는 서버가 없어 저장하지 않고 화면 흐름만 보여줍니다.
      setBusy(false);
      setDone(true);
      return;
    }
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq('id', user.id);
    setBusy(false);
    if (upErr) return setError(upErr.message);
    await refreshProfile();
    setDone(true);
    navigation.goBack();
  };

  return (
    <Screen>
      <Banner kind="error">{error ?? undefined}</Banner>
      <Banner kind="success">{done && PREVIEW_MODE ? '미리보기 모드에서는 저장되지 않아요.' : undefined}</Banner>
      <Field label="이름">
        <Input value={name} onChangeText={setName} maxLength={20} placeholder="이름" />
      </Field>
      <Field label="연락처 (선택)">
        <Input value={phone} onChangeText={(t) => setPhone(t.replace(/[^\d-]/g, ''))} keyboardType="phone-pad" maxLength={13} placeholder="010-0000-0000" />
      </Field>
      <Muted style={{ marginBottom: 16 }}>이메일과 소속은 여기서 바꿀 수 없어요. 소속 변경은 학원에 문의해 주세요.</Muted>
      <Button title="저장" onPress={save} loading={busy} disabled={!name.trim()} />
    </Screen>
  );
}
