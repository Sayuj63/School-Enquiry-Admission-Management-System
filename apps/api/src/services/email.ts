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
}): Promise<SendEmailResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@nes.edu.in';

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
    title: `Counselling Session - ${schoolName}`,
    description: `Student: ${data.studentName}\\nToken ID: ${data.tokenId}\\n\\nPlease bring all required documents.`,
    location: data.location,
    startDate,
    endDate,
    attendees: [{ email: data.parentEmail, name: data.parentName }]
  };

  const icsContent = generateICSContent(event);

  const emailBody = `
Dear ${data.parentName},

Your counselling session for ${data.studentName}'s admission has been scheduled.

Details:
- Token ID: ${data.tokenId}
- Date: ${data.slotDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
      console.log(`Subject: Counselling Slot Confirmation - ${data.tokenId}`);
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
      subject: `Counselling Slot Confirmation - ${data.tokenId}`,
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
}): Promise<SendEmailResult> {
  const principalEmail = process.env.PRINCIPAL_EMAIL || 'principal@nes.edu.in';
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@nes.edu.in';

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
    title: `Counselling: ${data.studentName} - ${data.tokenId}`,
    description: `Student: ${data.studentName}\\nParent: ${data.parentName}\\nToken ID: ${data.tokenId}`,
    location: data.location,
    startDate,
    endDate,
    attendees: [{ email: principalEmail, name: 'Principal' }]
  };

  const icsContent = generateICSContent(event);

  const emailBody = `
Counselling Session Scheduled

Student: ${data.studentName}
Parent: ${data.parentName}
Token ID: ${data.tokenId}
Date: ${data.slotDate.toLocaleDateString('en-IN')}
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
      console.log(`Subject: Counselling Session - ${data.slotStartTime} - ${data.studentName}`);
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
      subject: `Counselling Session - ${data.slotStartTime} - ${data.studentName}`,
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
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@nes.edu.in';

  const emailBody = `
Dear ${data.parentName},

Thank you for your interest in ${schoolName}.

This is to confirm that ${data.studentName} has been added to our waitlist for Grade ${data.grade}.

Token ID: ${data.tokenId}

We have currently reached our maximum capacity for this grade. Should a seat become available, our admissions team will contact you directly to proceed with the next steps.

Best regards,
${schoolName} Admissions Team
  `.trim();

  try {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      console.log('========================================');
      console.log('EMAIL SERVICE (WAITLIST MOCK MODE)');
      console.log('----------------------------------------');
      console.log(`To: ${data.parentEmail}`);
      console.log(`Subject: Waitlist Application Confirmation - ${data.tokenId}`);
      console.log('Body:');
      console.log(emailBody);
      console.log('========================================');

      return {
        success: true,
        message: 'Waitlist email sent successfully (dev mode)',
        mockMessage: emailBody,
        to: data.parentEmail
      };
    }

    const resend = getResendClient();
    if (!resend) {
      return { success: false, message: 'Email service not configured' };
    }

    const fromAddress = (process.env.USE_RESEND_ONBOARDING === 'true' || schoolEmail === 'info@nes.edu.in' || !schoolEmail)
      ? 'onboarding@resend.dev'
      : `${schoolName} <${schoolEmail}>`;

    await resend.emails.send({
      from: fromAddress,
      to: [data.parentEmail],
      subject: `Waitlist Application Confirmation - ${data.tokenId}`,
      text: emailBody
    });

    console.log('✅ Waitlist email sent successfully via Resend.');
    return {
      success: true,
      message: 'Waitlist confirmation email sent to parent'
    };
  } catch (error: any) {
    console.error('❌ Waitlist email sending error:', error);
    return {
      success: false,
      message: `Failed to send email: ${error.message}`
    };
  }
}

/**
 * Send admission status update email to parent
 */
export async function sendAdmissionStatusEmail(data: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  tokenId: string;
  status: 'approved' | 'rejected' | 'waitlisted' | 'confirmed';
}): Promise<SendEmailResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@nes.edu.in';

  let statusText = '';
  let statusDetail = '';

  switch (data.status) {
    case 'approved':
    case 'confirmed':
      statusText = 'Admission Confirmed';
      statusDetail = 'Congratulations! We are pleased to inform you that your child\'s admission has been approved. Our team will contact you shortly regarding the next steps, fee payment, and documentation.';
      break;
    case 'rejected':
      statusText = 'Admission Update';
      statusDetail = 'We regret to inform you that we are unable to proceed with your admission application at this time.';
      break;
    case 'waitlisted':
      statusText = 'Waitlist Status';
      statusDetail = 'Your application has been placed on the waitlist. We will notify you if a seat becomes available.';
      break;
  }

  const subject = `${statusText} - ${data.studentName} (${data.tokenId})`;

  const emailBody = `
Dear ${data.parentName},

This is an update regarding ${data.studentName}'s admission application at ${schoolName}.

Token ID: ${data.tokenId}
New Status: ${data.status.toUpperCase()}

${statusDetail}

Best regards,
${schoolName} Admissions Team
  `.trim();

  try {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      console.log('========================================');
      console.log('EMAIL SERVICE (STATUS MOCK MODE)');
      console.log('----------------------------------------');
      console.log(`To: ${data.parentEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('Body:');
      console.log(emailBody);
      console.log('========================================');

      return {
        success: true,
        message: 'Status update email sent (dev mode)',
        mockMessage: emailBody,
        to: data.parentEmail
      };
    }

    const resend = getResendClient();
    if (!resend) return { success: false, message: 'Email service not configured' };

    const fromAddress = (process.env.USE_RESEND_ONBOARDING === 'true' || schoolEmail === 'info@nes.edu.in' || !schoolEmail)
      ? 'onboarding@resend.dev'
      : `${schoolName} <${schoolEmail}>`;

    await resend.emails.send({
      from: fromAddress,
      to: [data.parentEmail],
      subject: subject,
      text: emailBody
    });

    return { success: true, message: 'Status update email sent' };
  } catch (error: any) {
    console.error('❌ Status update email error:', error);
    return { success: false, message: error.message };
  }
}
