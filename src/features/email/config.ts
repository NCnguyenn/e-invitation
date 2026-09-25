import { readSiteUrl, SiteUrlError } from './render';
import testProject from '../../../supabase/test-project.json';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailConfig = {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  siteUrl: string;
};

export type EmailConfigResult =
  | { ok: true; config: EmailConfig }
  | { ok: false; missing: string[]; message: string };

function missing(names: string[], detail: string): EmailConfigResult {
  return {
    ok: false,
    missing: names,
    message: `Thiếu hoặc sai cấu hình gửi email: ${names.join(', ')}. ${detail} Chưa giữ suất gửi.`,
  };
}

export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfigResult {
  const transport = env.EMAIL_TRANSPORT?.trim() ?? '';
  if ((env.EMAIL_TRANSPORT ?? '') !== transport) {
    return missing(['EMAIL_TRANSPORT'], 'Chế độ gửi email không được chứa khoảng trắng.');
  }
  if (transport && transport !== 'brevo' && transport !== 'stub') {
    return missing(['EMAIL_TRANSPORT'], 'Chế độ gửi email không được hỗ trợ.');
  }
  if (transport === 'stub' && (
    !['development', 'test'].includes(env.NODE_ENV ?? '') ||
    env.NETLIFY === 'true' || Boolean(env.CONTEXT) ||
    env.SUPABASE_TARGET !== 'test' || env.NEXT_PUBLIC_SUPABASE_URL !== testProject.url
  )) {
    return missing(['EMAIL_TRANSPORT'], 'Email giả lập chỉ được dùng khi kiểm thử local trên project test đã ghim.');
  }
  const absent: string[] = [];
  const apiKey = env.BREVO_API_KEY?.trim() ?? '';
  const senderEmail = env.BREVO_SENDER_EMAIL?.trim().toLowerCase() ?? '';
  const senderName = env.BREVO_SENDER_NAME?.trim() ?? '';
  const siteUrl = env.SITE_URL?.trim() ?? '';
  if (!apiKey) absent.push('BREVO_API_KEY');
  if (!senderEmail) absent.push('BREVO_SENDER_EMAIL');
  if (!senderName) absent.push('BREVO_SENDER_NAME');
  if (!siteUrl) absent.push('SITE_URL');
  if (absent.length > 0) {
    return missing(absent, 'Không dùng APP_BASE_URL hoặc origin của request để tạo link.');
  }
  if (apiKey.length > 500 || /\s/.test(apiKey)) {
    return missing(['BREVO_API_KEY'], 'Khóa API không đúng định dạng.');
  }
  if (!EMAIL.test(senderEmail) || senderEmail.length > 255) {
    return missing(['BREVO_SENDER_EMAIL'], 'Email người gửi không hợp lệ.');
  }
  if ([...senderName].length > 70 || /[\r\n]/.test(senderName)) {
    return missing(['BREVO_SENDER_NAME'], 'Tên người gửi phải từ 1 đến 70 ký tự.');
  }
  try {
    const parsed = readSiteUrl(siteUrl);
    return {
      ok: true,
      config: {
        apiKey,
        senderEmail,
        senderName,
        siteUrl: parsed.origin,
      },
    };
  } catch (error) {
    if (error instanceof SiteUrlError) {
      return missing(['SITE_URL'], error.message);
    }
    return missing(['SITE_URL'], 'SITE_URL không hợp lệ.');
  }
}
