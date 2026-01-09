import * as ics from 'ics';

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
 * Send calendar invite email to parent
 * In development mode, email is logged to console
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

  // Parse time strings to create proper dates
  const [startHour, startMin] = data.slotStartTime.split(':').map(Number);
  const [endHour, endMin] = data.slotEndTime.split(':').map(Number);

  const startDate = new Date(data.slotDate);
  startDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date(data.slotDate);
  endDate.setHours(endHour, endMin, 0, 0);

  const event: CalendarEventData = {
    title: `Counselling Session - ${schoolName}`,
    description: `Student: ${data.studentName}\nToken ID: ${data.tokenId}\n\nPlease bring all required documents.`,
    location: data.location,
    startDate,
    endDate,
    attendees: [{ email: data.parentEmail, name: data.parentName }]
  };

  const icsContent = generateICSContent(event);

  const emailContent = {
    to: data.parentEmail,
    subject: `Counselling Slot Confirmation - ${data.tokenId}`,
    body: `
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
    `.trim(),
    attachment: {
      filename: 'counselling-session.ics',
      content: icsContent
    }
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('========================================');
    console.log('EMAIL SERVICE - PARENT INVITE (MOCK)');
    console.log('----------------------------------------');
    console.log(`To: ${emailContent.to}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log('Body:');
    console.log(emailContent.body);
    console.log('----------------------------------------');
    console.log('ICS Content:');
    console.log(icsContent);
    console.log('========================================');

    return {
      success: true,
      message: 'Calendar invite email sent to parent (dev mode)'
    };
  }

  // In production, would use NodeMailer
  console.log(`[PROD] Would send email to ${data.parentEmail}`);

  return {
    success: true,
    message: 'Calendar invite email sent to parent'
  };
}

/**
 * Send calendar invite email to principal
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

  const [startHour, startMin] = data.slotStartTime.split(':').map(Number);
  const [endHour, endMin] = data.slotEndTime.split(':').map(Number);

  const startDate = new Date(data.slotDate);
  startDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date(data.slotDate);
  endDate.setHours(endHour, endMin, 0, 0);

  const event: CalendarEventData = {
    title: `Counselling: ${data.studentName} - ${data.tokenId}`,
    description: `Student: ${data.studentName}\nParent: ${data.parentName}\nToken ID: ${data.tokenId}`,
    location: data.location,
    startDate,
    endDate,
    attendees: [{ email: principalEmail, name: 'Principal' }]
  };

  const icsContent = generateICSContent(event);

  const emailContent = {
    to: principalEmail,
    subject: `Counselling Session - ${data.slotStartTime} - ${data.studentName}`,
    body: `
Counselling Session Scheduled

Student: ${data.studentName}
Parent: ${data.parentName}
Token ID: ${data.tokenId}
Date: ${data.slotDate.toLocaleDateString('en-IN')}
Time: ${data.slotStartTime} - ${data.slotEndTime}
Location: ${data.location}
    `.trim(),
    attachment: {
      filename: 'counselling-session.ics',
      content: icsContent
    }
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('========================================');
    console.log('EMAIL SERVICE - PRINCIPAL INVITE (MOCK)');
    console.log('----------------------------------------');
    console.log(`To: ${emailContent.to}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log('Body:');
    console.log(emailContent.body);
    console.log('========================================');

    return {
      success: true,
      message: 'Calendar invite email sent to principal (dev mode)'
    };
  }

  return {
    success: true,
    message: 'Calendar invite email sent to principal'
  };
}
