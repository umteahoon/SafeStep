import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { BlockRoles } from '../../components/Guard';
import { EXPLORE_BLOCKED } from '../../lib/teams';
import { useAuth } from '../../lib/useAuth';
import { fetchPosts } from '../../lib/community';
import type { PostWithStats } from '../../lib/community';
import { CategoryTabs, PostItem } from '../../components/community';
import { Empty, Icon, Loading, Screen } from '../../components/ui';
import { colors, shadow } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { CommunityCategory } from '../../types';

function CommunityScreenInner() {
  const navigation = useNavigation<RootNav>();
  const { academyId } = useRoute<RouteProp<RootStackParamList, 'Community'>>().params;
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithStats[] | null>(null);
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setPosts(await fetchPosts(academyId, user?.id));
    const { data } = await supabase.from('academies').select('name').eq('id', academyId).maybeSingle();
    if ((data as any)?.name) {
      setName((data as any).name);
      navigation.setOptions({ title: `${(data as any).name} 커뮤니티` });
    }
  }, [academyId, user, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const write = () =>
    user
      ? navigation.navigate('PostWrite', { academyId })
      : navigation.navigate('Login', { next: { name: 'PostWrite', params: { academyId } } });

  const shown = (posts ?? []).filter((p) => !category || p.category === category);

  return (
    <Screen scroll={false} backgroundColor={colors.white}>
      <CategoryTabs value={category} onChange={setCategory} />
      {posts === null ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <Empty icon="chatbubbles-outline">
              {category ? '이 분류의 글이 아직 없어요' : `${name || '이 스터디카페'}의 첫 글을 남겨보세요`}
            </Empty>
          }
          renderItem={({ item }) => (
            <PostItem post={item} onPress={() => navigation.navigate('PostDetail', { postId: item.id })} />
          )}
        />
      )}

      <Pressable onPress={write} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
        <Icon name="create" size={20} color={colors.white} />
        <Text style={styles.fabText}>글쓰기</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    height: 50,
    ...shadow,
    shadowOpacity: 0.25,
  },
  fabText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});

export default function CommunityScreen() {
  return (
    <BlockRoles roles={EXPLORE_BLOCKED}>
      <CommunityScreenInner />
    </BlockRoles>
  );
}
