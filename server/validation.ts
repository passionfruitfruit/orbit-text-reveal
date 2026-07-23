import type { ValidationResult } from './contracts.ts';

type CommentValue = {
  nickname: string;
  body: string;
  contact: string | null;
  visitorAllowsPublic?: boolean;
};

const error = (code: string, message: string): ValidationResult<never> => ({
  ok: false,
  error: { code, message },
});

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateCommentInput(input: unknown, isReply: boolean): ValidationResult<CommentValue> {
  if (!input || typeof input !== 'object') return error('INVALID_BODY', '提交内容格式不正确');
  const record = input as Record<string, unknown>;
  const nickname = clean(record.nickname);
  const body = clean(record.body);
  const contact = clean(record.contact) || null;
  if (!nickname) return error('NICKNAME_REQUIRED', '请填写昵称');
  if (nickname.length > 30) return error('NICKNAME_TOO_LONG', '昵称最多 30 个字符');
  if (!body) return error('BODY_REQUIRED', '请填写留言内容');
  if (body.length > 2000) return error('BODY_TOO_LONG', '留言最多 2000 个字符');
  if (contact && contact.length > 200) return error('CONTACT_TOO_LONG', '联系方式最多 200 个字符');
  if (!isReply && typeof record.visitorAllowsPublic !== 'boolean') {
    return error('PUBLIC_CHOICE_REQUIRED', '请选择留言是否允许公开');
  }
  return {
    ok: true,
    value: isReply
      ? { nickname, body, contact }
      : { nickname, body, contact, visitorAllowsPublic: record.visitorAllowsPublic as boolean },
  };
}

type SourceValue = { platform: 'bilibili' | 'github'; account: string; enabled: boolean };

export function validateSourceInput(input: unknown): ValidationResult<SourceValue> {
  if (!input || typeof input !== 'object') return error('INVALID_BODY', '来源格式不正确');
  const record = input as Record<string, unknown>;
  if (record.platform !== 'bilibili' && record.platform !== 'github') {
    return error('INVALID_PLATFORM', '只支持 Bilibili 或 GitHub');
  }
  const account = clean(record.account);
  const valid = record.platform === 'bilibili'
    ? /^\d{1,20}$/.test(account)
    : /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(account);
  if (!valid) return error('INVALID_ACCOUNT', '账号格式不正确');
  return { ok: true, value: { platform: record.platform, account, enabled: record.enabled !== false } };
}
