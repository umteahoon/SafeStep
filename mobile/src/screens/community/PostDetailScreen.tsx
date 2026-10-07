import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { BlockRoles } from '../../components/Guard';
import { EXPLORE_BLOCKED } from '../../lib/teams';
import { useAuth } from '../../lib/useAuth';
import { addComment, deleteComment, deletePost, fetchComments, fetchPost, timeAgo, toggleLike } from '../../lib/community';
import type { PostWithStats } from '../../lib/community';
import { CategoryTag } from '../../components/community';
import { Button, Empty, Icon, Input, Loading, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { CommunityComment } from '../../types';

function PostDetailScreenInner() {
  const navigation = useNavigation<RootNav>();
  const { postId } = useRoute<RouteProp<RootStackParamList, 'PostDetail'>>().params;
  const { user, profile } = useAuth();
  const [post, setPost] = useState<PostWithStats | null | undefined>(undefined);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([fetchPost(postId, user?.id), fetchComments(postId)]);
    setPost(p);
    setComments(c);
  }, [postId, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const needLogin = () => navigation.navigate('Login', { next: { name: 'PostDetail', params: { postId } } });

  // 운영진(같은 스터디카페 소속 원장·강사)은 모든 글·댓글을 삭제할 수 있음
  const isStaffHere =
    !!post && !!profile && (profile.role === 'ACADEMY_ADMIN' || profile.role === 'TEACHER') && profile.academy_id === post.academy_id;

  const onLike = async () => {
    if (!user) return needLogin();
    if (!post) return;
    // 낙관적 업데이트
    setPost({ ...post, likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) });
    await toggleLike(post.id, user.id, post.likedByMe);
  };

  const send = async () => {
    if (!user) return needLogin();
    if (!post || !text.trim()) return;
    setSending(true);
    await addComment(post.id, user.id, text);
    setText('');
    setSending(false);
    load();
  };

  const removePost = () =>
    Alert.alert('이 글을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deletePost(postId);
          navigation.goBack();
        },
      },
    ]);

  const removeComment = (id: string) =>
    Alert.alert('댓글을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteComment(id);
          load();
        },
      },
    ]);

  if (post === undefined) return <Loading />;
  if (post === null)
    return (
      <Screen>
        <Empty icon="document-outline">삭제되었거나 존재하지 않는 글이에요</Empty>
      </Screen>
    );

  const canDeletePost = post.author_id === user?.id || isStaffHere;

  return (
    <Screen scroll={false} backgroundColor={colors.white}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={styles.post}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <CategoryTag category={post.category} />
              {canDeletePost && (
                <Pressable onPress={removePost} hitSlop={10}>
                  <Icon name="trash-outline" size={19} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Text style={styles.title}>{post.title}</Text>
            <Text style={styles.meta}>
              {post.author?.name ?? '익명'}
              {post.author?.role === 'ACADEMY_ADMIN' || post.author?.role === 'TEACHER' ? ' · 운영진' : ''} · {timeAgo(post.created_at)}
            </Text>
            <Text style={styles.content}>{post.content}</Text>
            <View style={styles.actions}>
              <Pressable onPress={onLike} style={[styles.likeBtn, post.likedByMe && { backgroundColor: '#FFE9EE' }]}>
                <Icon name={post.likedByMe ? 'heart' : 'heart-outline'} size={18} color={post.likedByMe ? '#F43F5E' : colors.textSub} />
                <Text style={[styles.likeText, post.likedByMe && { color: '#F43F5E' }]}>좋아요 {post.likeCount}</Text>
              </Pressable>
              <View style={styles.countRow}>
                <Icon name="chatbubble-outline" size={15} color={colors.textMuted} />
                <Text style={styles.countText}>댓글 {comments.length}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </View>
        }
        ListEmptyComponent={<Text style={styles.noComment}>첫 댓글을 남겨보세요</Text>}
        renderItem={({ item }) => {
          const mine = item.author_id === user?.id;
          const staff = item.author?.role === 'ACADEMY_ADMIN' || item.author?.role === 'TEACHER';
          return (
            <View style={styles.comment}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.commentName}>{item.author?.name ?? '익명'}</Text>
                {staff && <Text style={styles.staff}>운영진</Text>}
                <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
                <View style={{ flex: 1 }} />
                {(mine || isStaffHere) && (
                  <Pressable onPress={() => removeComment(item.id)} hitSlop={10}>
                    <Icon name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
              <Text style={styles.commentText}>{item.content}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        {user ? (
          <>
            <Input value={text} onChangeText={setText} placeholder="댓글을 입력하세요" style={{ flex: 1, paddingVertical: 10 }} maxLength={500} />
            <Button title="등록" small onPress={send} loading={sending} disabled={!text.trim()} />
          </>
        ) : (
          <Button title="로그인하고 댓글 남기기" variant="secondary" onPress={needLogin} style={{ flex: 1 }} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  post: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginTop: 12, lineHeight: 30 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  content: { fontSize: 16, color: '#1F2937', lineHeight: 26, marginTop: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F5F8', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  likeText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countText: { fontSize: 13, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 20 },
  noComment: { textAlign: 'center', color: colors.textMuted, paddingVertical: 36, fontSize: 14 },
  comment: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  commentName: { fontSize: 13, fontWeight: '800', color: colors.text },
  staff: { fontSize: 10, fontWeight: '800', color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  commentTime: { fontSize: 12, color: colors.textMuted },
  commentText: { fontSize: 15, color: '#1F2937', lineHeight: 22, marginTop: 6 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.white },
});

export default function PostDetailScreen() {
  return (
    <BlockRoles roles={EXPLORE_BLOCKED}>
      <PostDetailScreenInner />
    </BlockRoles>
  );
}
