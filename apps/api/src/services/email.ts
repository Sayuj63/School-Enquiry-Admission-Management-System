import * as ics from 'ics';
import { Resend } from 'resend';

// Lazy-load Resend client to ensure environment variables are loaded first
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_your_api_key') {
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  attendees: Array<{ email: string; name?: string }>;
}

interface SendEmailResult {
  success: boolean;
  message: string;
  mockMessage?: string;
  to?: string;
}

/**
 * Generate ICS calendar file content
 */
function generateICSContent(event: CalendarEventData): string {
  const start = event.startDate;
  const end = event.endDate;

  const { value, error } = ics.createEvent({
    title: event.title,
    description: event.description,
    location: event.location,
    start: [
      start.getFullYear(),
      start.getMonth() + 1,
      start.getDate(),
      start.getHours(),
      start.getMinutes()
    ],
    end: [
      end.getFullYear(),
      end.getMonth() + 1,
      end.getDate(),
      end.getHours(),
      end.getMinutes()
    ],
    startOutputType: 'local',
    endOutputType: 'local',
    attendees: event.attendees.map(a => ({
      email: a.email,
      name: a.name,
      partstat: 'NEEDS-ACTION'
    }))
  });

  if (error) {
    console.error('ICS generation error:', error);
    return '';
  }

  return value || '';
}

/**
 * Send calendar invite email to parent using Resend
 */
export async function sendParentCalendarInvite(data: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  tokenId: string;
  slotDate: Date;
  slotStartTime: string;
  slotEndTime: string;
  location: string;
  isReschedule?: boolean;
}): Promise<SendEmailResult> {
  const schoolName = (process.env.SCHOOL_NAME && !process.env.SCHOOL_NAME.includes('ABC'))
    ? process.env.SCHOOL_NAME
    : 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'admissions@nes.edu.in';

  // Parse date and time strings to create proper dates without timezone shift
  const [startHour, startMin] = data.slotStartTime.split(':').map(Number);
  const [endHour, endMin] = data.slotEndTime.split(':').map(Number);

  // Use the Date object from database (which is UTC midnight) to get components
  const year = data.slotDate.getUTCFullYear();
  const month = data.slotDate.getUTCMonth();
  const day = data.slotDate.getUTCDate();

  // Create dates in local time (or whatever timezone the server is in)
  // but based on the intended date components from UTC
  const startDate = new Date(year, month, day, startHour, startMin, 0, 0);
  const endDate = new Date(year, month, day, endHour, endMin, 0, 0);

  const event: CalendarEventData = {
    title: `${data.isReschedule ? 'RESCHEDULED: ' : ''}Counselling Session - ${schoolName}`,
    description: `Student: ${data.studentName}\\nToken ID: ${data.tokenId}\\n\\nPlease bring all required documents.`,
    location: data.location,
    startDate,
    endDate,
    attendees: [{ email: data.parentEmail, name: data.parentName }]
  };

  const icsContent = generateICSContent(event);

  const emailBody = `
Dear ${data.parentName},

${data.isReschedule ? 'Please note that your counselling session has been rescheduled.' : `Your counselling session for ${data.studentName}'s admission has been scheduled.`}

Details:
- Token ID: ${data.tokenId}
- Date: ${data.slotDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })}
- Time: ${data.slotStartTime} - ${data.slotEndTime}
- Location: ${data.location}

Please bring all required documents for verification.

Best regards,
${schoolName} Admissions Team
  `.trim();


  // Send via Resend
  try {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      console.log('========================================');
      console.log('EMAIL SERVICE (MOCK MODE)');
      console.log('----------------------------------------');
      console.log(`To: ${data.parentEmail}`);
      console.log(`Subject: ${data.isReschedule ? 'Rescheduled: ' : ''}Counselling Slot Confirmation - ${data.tokenId}`);
      console.log('Body:');
      console.log(emailBody);
      console.log('========================================');

      return {
        success: true,
        message: 'Email sent successfully (dev mode)',
        mockMessage: emailBody,
        to: data.parentEmail
      };
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn('⚠️  Resend API key not configured or using default placeholder. Email will not be sent.');
      console.warn('Set RESEND_API_KEY in environment variables to enable email sending.');
      return {
        success: false,
        message: 'Email service not configured. Please set RESEND_API_KEY in environment variables.'
      };
    }

    // Resend requires a verified domain or onboarding@resend.dev
    // If you haven't verified a domain, you MUST use onboarding@resend.dev as 'from'
    const fromAddress = (process.env.USE_RESEND_ONBOARDING === 'true' || schoolEmail === 'info@nes.edu.in' || !schoolEmail)
      ? 'onboarding@resend.dev'
      : `${schoolName} <${schoolEmail}>`;

    console.log(`Attempting to send email from ${fromAddress} to ${data.parentEmail}...`);

    const { data: emailData, error } = await resend.emails.send({
      from: fromAddress,
      to: [data.parentEmail],
      subject: `${data.isReschedule ? 'Rescheduled: ' : ''}Counselling Slot Confirmation - ${data.tokenId}`,
      text: emailBody,
      attachments: [
        {
          filename: 'counselling-session.ics',
          content: Buffer.from(icsContent),
        },
      ],
    });

    if (error) {
      console.error('❌ Resend execution error details:', JSON.stringify(error, null, 2));
      let errorMessage = `Failed to send email via Resend: ${error.name} - ${error.message}`;

      if ((error as any).statusCode === 403) {
        errorMessage = "Resend 403 Error: Domain validation failed or recipient unauthorized. If you are on a Resend Free/Trial plan, you must verify your domain or send only to your account's verified email. Alternatively, set USE_RESEND_ONBOARDING=true and ensure you are sending to your own email.";
      }

      return {
        success: false,
        message: errorMessage
      };
    }

    console.log('✅ Email sent successfully via Resend. ID:', emailData?.id);
    return {
      success: true,
      message: 'Calendar invite email sent to parent'
    };
  } catch (error: any) {
    console.error('❌ Email sending error:', error);
    return {
      success: false,
      message: `Failed to send email: ${error.message}`
    };
  }
}

/**
 * Send calendar invite email to principal using Resend
 */
export async function sendPrincipalCalendarInvite(data: {
  studentName: string;
  parentName: string;
  tokenId: string;
  slotDate: Date;
  slotStartTime: string;
  slotEndTime: string;
  location: string;
  isReschedule?: boolean;
}): Promise<SendEmailResult> {
  const principalEmail = process.env.PRINCIPAL_EMAIL || 'admissions@nes.edu.in';
  const schoolName = (process.env.SCHOOL_NAME && !process.env.SCHOOL_NAME.includes('ABC'))
    ? process.env.SCHOOL_NAME
    : 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'admissions@nes.edu.in';

  // Parse date and time strings to create proper dates without timezone shift
  const [startHour, startMin] = data.slotStartTime.split(':').map(Number);
  const [endHour, endMin] = data.slotEndTime.split(':').map(Number);

  // Use the Date object from database (which is UTC midnight) to get components
  const year = data.slotDate.getUTCFullYear();
  const month = data.slotDate.getUTCMonth();
  const day = data.slotDate.getUTCDate();

  // Create dates in local time (or whatever timezone the server is in)
  // but based on the intended date components from UTC
  const startDate = new Date(year, month, day, startHour, startMin, 0, 0);
  const endDate = new Date(year, month, day, endHour, endMin, 0, 0);

  const event: CalendarEventData = {
    title: `${data.isReschedule ? 'RESCHEDULED: ' : ''}Counselling: ${data.studentName} - ${data.tokenId}`,
    description: `Student: ${data.studentName}\\nParent: ${data.parentName}\\nToken ID: ${data.tokenId}`,
    location: data.location,
    startDate,
    endDate,
    attendees: [{ email: principalEmail, name: 'Principal' }]
  };

  const icsContent = generateICSContent(event);

  const emailBody = `
${data.isReschedule ? 'RESCHEDULED: ' : ''}Counselling Session Scheduled

Student: ${data.studentName}
Parent: ${data.parentName}
Token ID: ${data.tokenId}
Date: ${data.slotDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
Time: ${data.slotStartTime} - ${data.slotEndTime}
Location: ${data.location}
  `.trim();


  // Send via Resend
  try {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      console.log('========================================');
      console.log('EMAIL SERVICE (PRINCIPAL MOCK MODE)');
      console.log('----------------------------------------');
      console.log(`To: ${principalEmail}`);
      console.log(`Subject: ${data.isReschedule ? 'Rescheduled: ' : ''}Counselling Session - ${data.slotStartTime} - ${data.studentName}`);
      console.log('Body:');
      console.log(emailBody);
      console.log('========================================');

      return {
        success: true,
        message: 'Principal email sent successfully (dev mode)',
        mockMessage: emailBody,
        to: principalEmail
      };
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn('⚠️  Resend API key not configured or using default placeholder. Email will not be sent.');
      console.warn('Set RESEND_API_KEY in environment variables to enable email sending.');
      return {
        success: false,
        message: 'Email service not configured. Please set RESEND_API_KEY in environment variables.'
      };
    }

    // Resend requires a verified domain or onboarding@resend.dev
    const fromAddress = (process.env.USE_RESEND_ONBOARDING === 'true' || schoolEmail === 'info@nes.edu.in' || !schoolEmail)
      ? 'onboarding@resend.dev'
      : `${schoolName} <${schoolEmail}>`;

    console.log(`Attempting to send principal email from ${fromAddress} to ${principalEmail}...`);

    const { data: emailData, error } = await resend.emails.send({
      from: fromAddress,
      to: [principalEmail],
      subject: `${data.isReschedule ? 'Rescheduled: ' : ''}Counselling Session - ${data.slotStartTime} - ${data.studentName}`,
      text: emailBody,
      attachments: [
        {
          filename: 'counselling-session.ics',
          content: Buffer.from(icsContent),
        },
      ],
    });

    if (error) {
      console.error('❌ Resend execution error details (Principal):', JSON.stringify(error, null, 2));
      let errorMessage = `Failed to send email to principal: ${error.name} - ${error.message}`;

      if ((error as any).statusCode === 403) {
        errorMessage = "Resend 403 Error (Principal): Domain validation failed or recipient unauthorized.";
      }

      return {
        success: false,
        message: errorMessage
      };
    }

    console.log('✅ Principal email sent successfully via Resend. ID:', emailData?.id);
    return {
      success: true,
      message: 'Calendar invite email sent to principal'
    };
  } catch (error: any) {
    console.error('❌ Email sending error:', error);
    return {
      success: false,
      message: `Failed to send email: ${error.message}`
    };
  }
}

/**
 * Send waitlist joining confirmation email to parent using Resend
 */
export async function sendWaitlistEmail(data: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  tokenId: string;
  grade: string;
}): Promise<SendEmailResult> {
  const schoolName = (process.env.SCHOOL_NAME && !process.env.SCHOOL_NAME.includes('ABC'))
    ? process.env.SCHOOL_NAME
    : 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'admissions@nes.edu.in';

  const emailBody = `
Dear ${data.parentName},

We have received your admission application for ${data.studentName} for Grade ${data.grade}.

Currently, all available counselling slots for this grade are full. Your application has been placed on our waitlist (Token ID: ${data.tokenId}).

We will notify you via email and WhatsApp as soon as new slots become available. You will then be able to log in to our portal and book a preferred time for your counselling session.

Thank you for your patience and interest in ${schoolName}.

Best regards,
${schoolName} Admissions Team
  `.trim();

  try {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      console.log('========================================');
      console.log('EMAIL SERVICE (WAITLIST MOCK MODE)');
      console.log('----------------------------------------');
      console.log(`To: ${data.parentEmail}`);
      console.log(`Subject: Application Waitlisted - ${data.tokenId}`);
      console.log('Body:');
      console.log(emailBody);
      console.log('========================================');

      return {
        success: true,
        message: 'Waitlist email sent (dev mode)',
        mockMessage: emailBody,
        to: data.parentEmail
      };
    }

    const resend = getResendClient();
    if (!resend) return { success: false, message: 'Email service not configured.' };

    const fromAddress = (process.env.USE_RESEND_ONBOARDING === 'true' || schoolEmail === 'info@nes.edu.in' || !schoolEmail)
      ? 'onboarding@resend.dev'
      : `${schoolName} <${schoolEmail}>`;

    await resend.emails.send({
      from: fromAddress,
      to: [data.parentEmail],
      subject: `Application Waitlisted - ${data.tokenId}`,
      text: emailBody,
    });

    return { success: true, message: 'Waitlist notification sent' };
  } catch (err: any) {
    console.error('Waitlist email error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Send admission status update email (Confirmed, Approved, Rejected)
 */
export async function sendAdmissionStatusEmail(data: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  tokenId: string;
  status: 'confirmed' | 'approved' | 'rejected' | 'waitlisted';
}): Promise<SendEmailResult> {
  const schoolName = (process.env.SCHOOL_NAME && !process.env.SCHOOL_NAME.includes('ABC'))
    ? process.env.SCHOOL_NAME
    : 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'admissions@nes.edu.in';

  let subject = '';
  let emailBody = '';

  const dashboardUrl = (process.env.FRONTEND_URL || 'https://nes.edu.in') + '/parent/login';

  switch (data.status) {
    case 'confirmed':
      subject = `Admission Confirmed - ${data.studentName}`;
      emailBody = `
Dear ${data.parentName},

Congratulations! The admission for ${data.studentName} (Token: ${data.tokenId}) has been CONFIRMED.

Our team will contact you shortly regarding the next steps, fee payment, and document submission.

You can also check your status on our portal: ${dashboardUrl}

Best regards,
${schoolName} Admissions Team
      `.trim();
      break;
    case 'approved':
      subject = `Admission Approved - ${data.studentName}`;
      emailBody = `
Dear ${data.parentName},

We are pleased to inform you that the admission application for ${data.studentName} (Token: ${data.tokenId}) has been APPROVED.

Please log in to our portal to complete the remaining formalities: ${dashboardUrl}

Best regards,
${schoolName} Admissions Team
      `.trim();
      break;
    case 'rejected':
      subject = `Admission Update - ${data.studentName}`;
      emailBody = `
Dear ${data.parentName},

Thank you for your interest in ${schoolName}.

After careful consideration of the application for ${data.studentName} (Token: ${data.tokenId}), we regret to inform you that we are unable to offer admission at this time.

We wish ${data.studentName} the very best in their future academic endeavors.

Best regards,
${schoolName} Admissions Team
      `.trim();
      break;
    case 'waitlisted':
      subject = `Admission Waitlisted - ${data.studentName}`;
      emailBody = `
Dear ${data.parentName},

The application for ${data.studentName} (Token: ${data.tokenId}) has been placed on our waitlist.

This usually happens when all available seats for the requested grade are currently filled or pending confirmation. We will notify you if a seat becomes available.

Best regards,
${schoolName} Admissions Team
      `.trim();
      break;
  }

  try {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      console.log('========================================');
      console.log('EMAIL SERVICE (STATUS UPDATE MOCK)');
      console.log(`To: ${data.parentEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('========================================');
      return { success: true, message: 'Status email sent (mock)' };
    }

    const resend = getResendClient();
    if (!resend) return { success: false, message: 'Email service not configured.' };

    const fromAddress = (process.env.USE_RESEND_ONBOARDING === 'true' || schoolEmail === 'info@nes.edu.in' || !schoolEmail)
      ? 'onboarding@resend.dev'
      : `${schoolName} <${schoolEmail}>`;

    await resend.emails.send({
      from: fromAddress,
      to: [data.parentEmail],
      subject,
      text: emailBody,
    });

    return { success: true, message: 'Status update email sent' };
  } catch (err: any) {
    console.error('Status email error:', err);
    return { success: false, message: err.message };
  }
}
