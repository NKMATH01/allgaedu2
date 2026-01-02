import { Request, Response, NextFunction } from 'express';

// Session user type
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      name: string;
      role: 'admin' | 'branch' | 'student' | 'parent';
      branchId?: string;
    };
    originalAdmin?: {
      id: string;
      username: string;
      name: string;
      role: 'admin' | 'branch' | 'student' | 'parent';
      branchId?: string;
    };
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
}

export function requireBranchManager(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  if (req.session.user.role !== 'admin' && req.session.user.role !== 'branch') {
    return res.status(403).json({ message: '지점 관리자 권한이 필요합니다.' });
  }
  next();
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  if (req.session.user.role !== 'student') {
    return res.status(403).json({ message: '학생 계정이 필요합니다.' });
  }
  next();
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  if (req.session.user.role !== 'parent') {
    return res.status(403).json({ message: '학부모 계정이 필요합니다.' });
  }
  next();
}

export function requireStudentOrParent(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  if (req.session.user.role !== 'student' && req.session.user.role !== 'parent') {
    return res.status(403).json({ message: '학생 또는 학부모 계정이 필요합니다.' });
  }
  next();
}
