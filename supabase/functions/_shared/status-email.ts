import nodemailer from 'npm:nodemailer@10.0.15';

const emailStatuses = new Map([
  ['Application Ready for Issuance', 'Ready for Issuance'],
  ['Application Documents Required', 'Documents Required'],
]);
const portalUrl = 'https://rae1124.github.io/';
const systemName = 'Student ID Replacement System';
const safeMailErrors = new Set([
  'EAUTH',
  'ECONNECTION',
  'ECONNRESET',
  'ECONNREFUSED',
  'EDNS',
  'ETIMEDOUT',
  'ESOCKET',
  'ETLS',
  'EENVELOPE',
  'EMESSAGE',
  'SMTP_CONFIGURATION',
]);

function isSingleMailbox(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(
      value,
    )
  );
}

function smtpSettings() {
  if (Deno.env.get('SMTP_ENABLED') !== 'true') return null;
  const host = Deno.env.get('SMTP_HOST') || '';
  const port = Number(Deno.env.get('SMTP_PORT') || '465');
  const user = Deno.env.get('SMTP_USER') || '';
  const password = Deno.env.get('SMTP_PASSWORD') || '';
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || '';
  // Supabase blocks ports 25/587; require implicit TLS and verified certificates.
  if (
    !/^[a-zA-Z0-9.-]+$/.test(host) ||
    port !== 465 ||
    !user ||
    !password ||
    !isSingleMailbox(fromEmail)
  )
    throw Object.assign(new Error('Invalid SMTP configuration.'), { code: 'SMTP_CONFIGURATION' });
  return {
    fromEmail,
    transport: {
      host,
      port,
      secure: true,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' as const },
      dnsTimeout: 5000,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
      maxRecipients: 1,
      logger: false,
      debug: false,
    },
  };
}

export async function sendStatusEmail(db: any, notificationId: string) {
  try {
    const { data: notification, error: noticeError } = await db
      .from('notifications')
      .select('id,user_id,request_id,title,message,email_status,email_attempts,email_attempted_at')
      .eq('id', notificationId)
      .maybeSingle();
    if (noticeError) throw Error('DATABASE_ERROR');
    if (!notification) return { status: 'not_found' };
    const targetStatus = emailStatuses.get(notification.title);
    if (!targetStatus) return { status: 'not_requested' };
    if (['sent', 'skipped', 'not_requested'].includes(notification.email_status))
      return { status: notification.email_status };

    const attempts = notification.email_attempts || 0;
    const elapsed = Date.now() - Date.parse(notification.email_attempted_at || '1970-01-01');
    if (notification.email_status === 'sending' && elapsed < 300000) return { status: 'sending' };
    if (attempts >= 5) return { status: 'exhausted' };
    if (attempts > 0 && elapsed < 60000) return { status: 'retry_later' };

    async function recordWithoutSending(status: string, errorCode: string | null = null) {
      const { error } = await db
        .from('notifications')
        .update({ email_status: status, email_error_code: errorCode })
        .eq('id', notificationId)
        .eq('email_status', notification.email_status)
        .eq('email_attempts', attempts);
      if (error) throw Error('DATABASE_ERROR');
      return { status };
    }

    const { data: application, error: requestError } = await db
      .from('id_requests')
      .select('id,student_user_id,application_no,status')
      .eq('id', notification.request_id)
      .maybeSingle();
    if (requestError) throw Error('DATABASE_ERROR');
    if (
      !application ||
      application.student_user_id !== notification.user_id ||
      application.status !== targetStatus
    )
      return await recordWithoutSending('skipped');
    const { data: student, error: studentError } = await db
      .from('users')
      .select('id,email')
      .eq('id', application.student_user_id)
      .eq('role', 'student')
      .eq('active', true)
      .maybeSingle();
    if (studentError) throw Error('DATABASE_ERROR');
    if (!student || !isSingleMailbox(student.email))
      return await recordWithoutSending('failed', 'INVALID_RECIPIENT');

    let settings;
    try {
      settings = smtpSettings();
    } catch {
      return await recordWithoutSending('failed', 'SMTP_CONFIGURATION');
    }
    if (!settings) return await recordWithoutSending('not_configured');

    const attemptNumber = attempts + 1;
    // Compare-and-set prevents concurrent requests from sending the same notification.
    const { data: claimed, error: claimError } = await db
      .from('notifications')
      .update({
        email_status: 'sending',
        email_attempts: attemptNumber,
        email_attempted_at: new Date().toISOString(),
        email_error_code: null,
      })
      .eq('id', notificationId)
      .eq('email_status', notification.email_status)
      .eq('email_attempts', attempts)
      .select('id')
      .maybeSingle();
    if (claimError) throw Error('DATABASE_ERROR');
    if (!claimed) return { status: 'sending' };

    const ready = targetStatus === 'Ready for Issuance';
    const subject = ready
      ? 'Your replacement ID is ready for issuance'
      : 'Additional documents required for your ID application';
    const introduction = ready
      ? 'Your replacement ID is ready for collection. Please follow the ID Office instructions below.'
      : 'The Registrar requires additional documents for your ID replacement application. Please follow the instructions below.';
    const transport = nodemailer.createTransport(settings.transport);
    let deliveryStatus = 'sent';
    let errorCode: string | null = null;
    try {
      const result = await transport.sendMail({
        from: { name: systemName, address: settings.fromEmail },
        to: { address: student.email },
        subject,
        text: `${systemName}\n\n${introduction}\n\nApplication: ${application.application_no}\nStatus: ${targetStatus}\n\n${notification.message}\n\nSign in to view your application: ${portalUrl}\n\nThis is an automatic application notification.`,
        messageId: `<id-notification-${notification.id}@${settings.fromEmail.split('@')[1]}>`,
      });
      if (
        !result.accepted?.some(
          (address: string) => address.toLowerCase() === student.email.toLowerCase(),
        )
      )
        throw Object.assign(new Error('Recipient was not accepted.'), { code: 'EENVELOPE' });
    } catch (error) {
      deliveryStatus = 'failed';
      const code = (error as { code?: string }).code || '';
      errorCode = safeMailErrors.has(code) ? code : 'SMTP_ERROR';
    } finally {
      transport.close();
    }
    const { data: recorded, error: recordError } = await db
      .from('notifications')
      .update({
        email_status: deliveryStatus,
        email_error_code: errorCode,
        email_sent_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', notificationId)
      .eq('email_status', 'sending')
      .eq('email_attempts', attemptNumber)
      .select('id')
      .maybeSingle();
    if (recordError || !recorded) throw Error('DATABASE_ERROR');
    return { status: deliveryStatus };
  } catch {
    // SMTP responses can contain addresses and credentials; never log raw errors.
    console.error('Email delivery state could not be recorded.', { notificationId });
    return { status: 'unknown' };
  }
}
