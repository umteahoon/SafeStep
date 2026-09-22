import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { AuthedRequest, requireAuth, requireRole } from '../middleware/auth';
import { sendAcademyAnnouncementPush } from '../services/PushService';

const router = Router();

router.use(requireAuth, requireRole('ACADEMY_ADMIN', 'TEACHER'));

// POST /api/chat/announce  { roomId, content }
// 공지방 글쓰기는 이 엔드포인트를 거치게 해서, 메시지 저장과 동시에
// 학부모들에게 Web Push 알림을 보냅니다. (공지방 자체 INSERT는 RLS로도 직원에게 허용돼
// 있지만, 알림 발송은 프론트에서 트리거할 방법이 없어 백엔드를 거칩니다)
router.post('/announce', async (req: AuthedRequest, res) => {
  const { roomId, content } = req.body ?? {};
  if (!roomId || !String(content ?? '').trim()) {
    return res.status(400).json({ error: 'roomId와 content가 필요합니다.' });
  }

  const { data: room, error: roomError } = await supabaseAdmin
    .from('chat_rooms')
    .select('id, academy_id, type')
    .eq('id', roomId)
    .maybeSingle();

  if (roomError) return res.status(500).json({ error: roomError.message });
  if (!room || room.academy_id !== req.academyId || room.type !== 'ANNOUNCEMENT') {
    return res.status(403).json({ error: '이 공지방에 글을 쓸 권한이 없습니다.' });
  }

  const { data: message, error: insertError } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      room_id: roomId,
      sender_id: req.userId,
      type: 'TEXT',
      content: String(content).trim(),
    })
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  // 알림 발송 실패가 메시지 전송 자체를 막지 않도록 결과를 기다리지 않고 진행
  sendAcademyAnnouncementPush(req.academyId!, String(content).trim()).catch(() => {});

  res.json({ success: true, message });
});

export default router;
