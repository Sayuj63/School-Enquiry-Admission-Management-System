import * as ics from 'ics';
import { Resend } from 'resend';

// Lazy-load Resend client to ensure environment variables are loaded first
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
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
  const schoolName = process.env.SCHOOL_NAME || 'ABC International School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@school.com';

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
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        message: 'Email sent successfully (dev mode)',
        mockMessage: emailBody,
        to: data.parentEmail
      };
    }

    const resend = getResendClient();
    if (!resend) {
      console.error('Resend API key not configured');
      return {
        success: false,
        message: 'Email service not configured'
      };
    }

    const { data: emailData, error } = await resend.emails.send({
      from: `${schoolName} <${schoolEmail}>`,
      to: [data.parentEmail],
      subject: `Counselling Slot Confirmation - ${data.tokenId}`,
      text: emailBody,
      attachments: [
        {
          filename: 'counselling-session.ics',
          content: Buffer.from(icsContent).toString('base64'),
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        message: `Failed to send email: ${error.message}`
      };
    }

    console.log('Email sent successfully via Resend:', emailData?.id);
    return {
      success: true,
      message: 'Calendar invite email sent to parent'
    };
  } catch (error: any) {
    console.error('Email sending error:', error);
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
  const principalEmail = process.env.PRINCIPAL_EMAIL || 'principal@school.com';
  const schoolName = process.env.SCHOOL_NAME || 'ABC International School';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@school.com';

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
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        message: 'Principal email sent successfully (dev mode)',
        mockMessage: emailBody,
        to: principalEmail
      };
    }

    const resend = getResendClient();
    if (!resend) {
      console.error('Resend API key not configured');
      return {
        success: false,
        message: 'Email service not configured'
      };
    }

    const { data: emailData, error } = await resend.emails.send({
      from: `${schoolName} <${schoolEmail}>`,
      to: [principalEmail],
      subject: `Counselling Session - ${data.slotStartTime} - ${data.studentName}`,
      text: emailBody,
      attachments: [
        {
          filename: 'counselling-session.ics',
          content: Buffer.from(icsContent).toString('base64'),
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        message: `Failed to send email: ${error.message}`
      };
    }

    console.log('Email sent successfully via Resend:', emailData?.id);
    return {
      success: true,
      message: 'Calendar invite email sent to principal'
    };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return {
      success: false,
      message: `Failed to send email: ${error.message}`
    };
  }
}
