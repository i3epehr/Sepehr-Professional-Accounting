import crypto from 'crypto';
import { User, UserRole, UserSession } from '../types/index.ts';
import { maskSessionToken } from '../lib/securityCalculations.ts';

// نگهداری نشست‌های کاربری (فعال و باطل‌شده)
const sessionsStore = new Map<string, UserSession>();

// تولید هش امن SHA-256 با Salt برای رمزهای عبور
export function hashPassword(password: string): string {
  const salt = 'kharrazi_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function verifyPassword(password: string, hash?: string): boolean {
  if (!hash) return false;
  return hashPassword(password) === hash;
}

export function parseDeviceLabel(userAgent: string = ''): string {
  const ua = userAgent.toLowerCase();
  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('mac')
    ? 'macOS'
    : ua.includes('android')
    ? 'Android'
    : ua.includes('iphone') || ua.includes('ipad')
    ? 'iOS'
    : ua.includes('linux')
    ? 'Linux'
    : 'سیستم فروشگاهی';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
    ? 'Chrome'
    : ua.includes('firefox/')
    ? 'Firefox'
    : ua.includes('safari/')
    ? 'Safari'
    : 'مرورگر وب';
  return `${browser} روی ${os}`;
}

// تولید توکن نشست (Session Token) با ثبت IP و مشخصات مرورگر
export function createSession(
  user: User,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    timeoutMinutes?: number;
  }
): UserSession {
  const token = `session_${crypto.randomBytes(24).toString('hex')}`;
  const now = Date.now();
  const timeoutMs = (options?.timeoutMinutes || 480) * 60 * 1000;
  const expiresAtMs = now + timeoutMs;
  const nowFa = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
  const expFa = `${new Date(expiresAtMs).toLocaleDateString('fa-IR')} ${new Date(expiresAtMs).toLocaleTimeString('fa-IR')}`;
  const ua = options?.userAgent || 'Kharrazi-POS-Client/1.0';

  const session: UserSession = {
    id: `sess-${now}-${Math.floor(Math.random() * 1000)}`,
    token,
    maskedToken: maskSessionToken(token),
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    ipAddress: options?.ipAddress || '127.0.0.1',
    userAgent: ua,
    deviceLabel: parseDeviceLabel(ua),
    createdAt: nowFa,
    createdAtMs: now,
    lastActivityAt: nowFa,
    lastActivityMs: now,
    expiresAt: expFa,
    expiresAtMs,
    isActive: true,
  };

  sessionsStore.set(token, session);
  return session;
}

export function getSession(token: string): UserSession | null {
  const session = sessionsStore.get(token);
  if (!session) return null;
  if (!session.isActive) return null;

  const now = Date.now();
  if (now > session.expiresAtMs) {
    session.isActive = false;
    session.revokedAt = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
    session.revokedReason = 'انقضای خودکار زمان نشست (Session Timeout)';
    return null;
  }

  // به‌روزرسانی آخرین فعالیت نشست
  session.lastActivityMs = now;
  session.lastActivityAt = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
  return session;
}

export function removeSession(token: string, revokedBy: string = 'کاربر', reason: string = 'خروج از سیستم (Logout)'): boolean {
  const session = sessionsStore.get(token);
  if (!session) return false;
  const now = Date.now();
  session.isActive = false;
  session.revokedAt = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
  session.revokedBy = revokedBy;
  session.revokedReason = reason;
  return true;
}

export function revokeSessionById(sessionId: string, revokedBy: string, reason: string = 'ابطال نشست توسط مدیر امنیت'): UserSession | null {
  for (const session of sessionsStore.values()) {
    if (session.id === sessionId) {
      const now = Date.now();
      session.isActive = false;
      session.revokedAt = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
      session.revokedBy = revokedBy;
      session.revokedReason = reason;
      return session;
    }
  }
  return null;
}

export function revokeAllUserSessions(userId: string, revokedBy: string, reason: string = 'خاتمه کلیه نشست‌های کاربر'): number {
  let count = 0;
  const now = Date.now();
  const nowFa = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
  for (const session of sessionsStore.values()) {
    if (session.userId === userId && session.isActive) {
      session.isActive = false;
      session.revokedAt = nowFa;
      session.revokedBy = revokedBy;
      session.revokedReason = reason;
      count++;
    }
  }
  return count;
}

export function listAllSessions(currentToken?: string | null): UserSession[] {
  const now = Date.now();
  const list: UserSession[] = [];
  for (const session of sessionsStore.values()) {
    if (session.isActive && now > session.expiresAtMs) {
      session.isActive = false;
      session.revokedAt = `${new Date(now).toLocaleDateString('fa-IR')} ${new Date(now).toLocaleTimeString('fa-IR')}`;
      session.revokedReason = 'انقضای خودکار زمان نشست';
    }
    const { token, ...safeSession } = session;
    list.push({
      ...safeSession,
      isCurrent: Boolean(currentToken && token === currentToken),
    });
  }
  return list.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

// ایجاد نشست اولیه پیش‌فرض برای دمو در صورت خالی بودن لیست نشست‌ها
export function ensureInitialSeedSession(adminUser: User): void {
  if (sessionsStore.size === 0 && adminUser) {
    createSession(adminUser, {
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
      timeoutMinutes: 480,
    });
  }
}

// بررسی مجوز ساده بر اساس نقش
export function checkPermission(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === 'admin') return true;
  return allowedRoles.includes(userRole);
}
