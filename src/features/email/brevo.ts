export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Verified against the live Brevo docs:
 * - https://developers.brevo.com/reference/send-transac-email
 * - https://developers.brevo.com/reference/send-transac-email.md
 * - https://developers.brevo.com/docs/heterogenous-versions-batch-emails
 *
 * Single send is POST https://api.brevo.com/v3/smtp/email with header api-key.
 * HTTP 201 plus a non-empty messageId is the acceptance evidence used here.
 * HTTP 202 means scheduled, which this adapter does not request, so 202 is unknown.
 * The JSON headers field is documented as custom email headers. Its example includes
 * "Idempotency-Key", but that is not documented as equivalent to batch headers.idempotencyKey.
 * Batch idempotency is headers.idempotencyKey, TTL 30 minutes, and a duplicate returns
 * duplicate_parameter without processing that retry. This payload is not a batch send.
 * This adapter sends neither key and does not retry the POST.
 */
const CERTAIN_REJECTION: Record<string, string> = {
  invalid_parameter: 'invalid_parameter',
  missing_parameter: 'missing_parameter',
  out_of_range: 'out_of_range',
  permission_denied: 'permission_denied',
  unauthorized: 'unauthorized',
  not_enough_credits: 'not_enough_credits',
  method_not_allowed: 'method_not_allowed',
  account_under_validation: 'account_under_validation',
  not_acceptable: 'not_acceptable',
  bad_request: 'bad_request',
  unprocessable_entity: 'unprocessable_entity',
  document_not_found: 'document_not_found',
  'Domain does not exist': 'domain_does_not_exist',
  'Authentication failed': 'authentication_failed',
  'Insufficient credits': 'insufficient_credits',
  'DMARC policy requires domain authentication': 'dmarc_domain_authentication_required',
  'DNS records not properly configured': 'dns_records_not_configured',
  'api-key not found': 'api_key_not_found',
  'Invalid parameters passed': 'invalid_parameters_passed',
  'Returned when invalid data posted': 'invalid_data_posted',
  'Returned when query params are invalid': 'invalid_query_params',
};

const UNCLEAR_CODES = new Set([
  'duplicate_parameter',
  'duplicate_request',
  'Request already processed',
  'campaign_processing',
  'campaign_sent',
]);

export type BrevoSendPayload = {
  sender: { email: string; name: string };
  to: [{ email: string; name: string }];
  subject: string;
  htmlContent: string;
  textContent: string;
};

export type BrevoObserved = {
  status: number;
  body: unknown;
  transportError?: 'transport_timeout' | 'transport_unreachable';
};

export type BrevoClassification =
  | { outcome: 'accepted'; messageId: string }
  | { outcome: 'rejected'; errorCode: string }
  | { outcome: 'unknown'; errorCode: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function classifyBrevoResponse(status: number, body: unknown): BrevoClassification {
  if (status === 201 && isRecord(body) && typeof body.messageId === 'string' && body.messageId.trim()) {
    const messageId = body.messageId.trim();
    if (messageId.length <= 255 && !/[\r\n]/.test(messageId)) {
      return { outcome: 'accepted', messageId };
    }
  }
  if (status === 400 && isRecord(body) && typeof body.code === 'string') {
    const mapped = CERTAIN_REJECTION[body.code];
    if (mapped) return { outcome: 'rejected', errorCode: mapped };
    if (UNCLEAR_CODES.has(body.code)) return { outcome: 'unknown', errorCode: 'provider_unclear' };
  }
  if (status === 0) return { outcome: 'unknown', errorCode: 'transport_unreachable' };
  if (status === 202) return { outcome: 'unknown', errorCode: 'unexpected_scheduled_response' };
  return { outcome: 'unknown', errorCode: status >= 100 && status <= 599 ? `http_${status}` : 'invalid_response' };
}

export async function postBrevoOnce(input: {
  apiKey: string;
  payload: BrevoSendPayload;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<BrevoObserved> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(BREVO_SEND_URL, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': input.apiKey,
      },
      body: JSON.stringify(input.payload),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    return { status: response.status, body };
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    return {
      status: 0,
      body: null,
      transportError: aborted ? 'transport_timeout' : 'transport_unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
