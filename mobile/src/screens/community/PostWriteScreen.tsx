import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAuth } from '../../lib/useAuth';
import { CATEGORIES, CATEGORY_LABEL, createPost } from '../../lib/community';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Chip, Field, Input, Muted, Screen } from '../../components/ui';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { CommunityCategory } from '../../types';

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { academyId } = useRoute<RouteProp<RootStackParamList, 'PostWrite'>>().params;
  const { user } = useAuth();
  const [category, setCategory] = useState<CommunityCategory>('FREE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createPost({ academyId, authorId: user.id, category, title, content });
    setBusy(false);
    if (err) {
      setError('글을 올리지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    navigation.goBack();
  };

  return (
    <Screen>
      <Field label="분류">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </Field>
      <Field label="제목">
        <Input value={title} onChangeText={setTitle} maxLength={100} placeholder="제목을 입력하세요" />
      </Field>
      <Field label="내용">
        <Input
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={2000}
          placeholder={'이웃과 나누고 싶은 이야기를 적어보세요.\n개인정보와 비방은 삭제될 수 있어요.'}
          style={{ minHeight: 180 }}
        />
      </Field>
      <Muted style={{ marginBottom: 14 }}>작성자 이름이 함께 표시돼요.</Muted>
      <Banner kind="error">{error ?? undefined}</Banner>
      <Button title="올리기" onPress={submit} loading={busy} disabled={!title.trim() || !content.trim()} />
    </Screen>
  );
}

export default function PostWriteScreen() {
  const { academyId } = useRoute<RouteProp<RootStackParamList, 'PostWrite'>>().params;
  return (
    <RequireRole
      roles={['SUPER_ADMIN', 'STUDENT']}
      next={{ name: 'PostWrite', params: { academyId } }}
    >
      <Inner />
    </RequireRole>
  );
}
