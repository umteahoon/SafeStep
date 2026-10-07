import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { fetchRecentPosts } from '../lib/community';
import type { PostWithStats } from '../lib/community';
import { PostItem } from './community';
import { SectionHeader } from './home';
import type { RootNav } from '../navigation/types';

/** 홈의 "스터디카페 이야기": 반응이 많은 최근 글 3개 (여러 스터디카페 글을 섞어서) */
export function CommunityTeaser() {
  const navigation = useNavigation<RootNav>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithStats[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [recent, { data: ac }] = await Promise.all([
          fetchRecentPosts(user?.id, 30),
          supabase.from('academies').select('id, name'),
        ]);
        if (!alive) return;
        // 반응(좋아요·댓글)이 많은 순, 같으면 최신순
        const ranked = [...recent]
          .sort((a, b) => b.likeCount * 2 + b.commentCount - (a.likeCount * 2 + a.commentCount) || +new Date(b.created_at) - +new Date(a.created_at))
          .slice(0, 3);
        setPosts(ranked);
        setNames(Object.fromEntries(((ac as any[]) ?? []).map((a) => [a.id, String(a.name).replace('SafeStep ', '')])));
      })();
      return () => {
        alive = false;
      };
    }, [user])
  );

  if (posts.length === 0) return null;
  return (
    <>
      <SectionHeader title="스터디카페 이야기" />
      <View style={{ marginHorizontal: -20 }}>
        {posts.map((p) => (
          <PostItem
            key={p.id}
            post={p}
            academyName={names[p.academy_id]}
            onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
          />
        ))}
      </View>
    </>
  );
}
