import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: string;
  academyId?: string | null;
}

/**
 * Authorization: Bearer <supabase access token> 를 검증하고
 * profiles 테이블에서 role/academy_id를 조회해 req에 첨부합니다.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다.' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
    token
  );

  if (userError || !userData.user) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, academy_id')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: '프로필을 찾을 수 없습니다.' });
  }

  req.userId = userData.user.id;
  req.userRole = profile.role;
  req.academyId = profile.academy_id;
  next();
}

/**
 * 지정된 역할만 허용. 슈퍼관리자라 해도 명시적으로 포함되지 않으면 차단됩니다.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: '이 작업에 대한 권한이 없습니다.' });
    }
    next();
  };
}
