import { DocumentsList } from '../models';

interface WhatsAppMessage {
  to: string;
  tokenId: string;
  studentName: string;
  parentName: string;
}

interface SendWhatsAppResult {
  success: boolean;
  message: string;
  mockMessage?: string;
  to?: string;
}

/**
 * Get the list of required documents as formatted string
 */
async function getDocumentsList(): Promise<string> {
  const docsList = await DocumentsList.findOne();
  if (!docsList || docsList.documents.length === 0) {
    return 'Please contact the school for the list of required documents.';
  }

  return docsList.documents
    .sort((a, b) => a.order - b.order)
    .map((doc, index) => `${index + 1}. ${doc.name}${doc.required ? ' (Required)' : ' (Optional)'}`)
    .join('\n');
}

/**
 * Normalize phone number for Twilio WhatsApp
 */
function normalizeWhatsAppNumber(mobile: string): string {
  let digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return `whatsapp:+${digits}`;
}

/**
 * Send WhatsApp message with brochure and documents list
 * In development mode, message is logged to console instead of being sent
 */
export async function sendEnquiryWhatsApp(data: WhatsAppMessage): Promise<SendWhatsAppResult> {
  const schoolName = (process.env.SCHOOL_NAME && !process.env.SCHOOL_NAME.includes('ABC'))
    ? process.env.SCHOOL_NAME
    : 'New Era High School';
  const schoolPhone = process.env.SCHOOL_PHONE || '+919876543210';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'admissions@nes.edu.in';

  const documentsList = await getDocumentsList();

  const message = `
🎓 *Thank you for your interest in ${schoolName}!*

Dear ${data.parentName},

We have received your enquiry for ${data.studentName}'s admission.

📋 *Your Enquiry Token ID:* ${data.tokenId}
(Please keep this for future reference)

📄 *Documents Required for School Visit:*
${documentsList}

📥 *School Brochure:*
[Brochure PDF would be attached here]

📞 *Contact Us:*
Phone: ${schoolPhone}
Email: ${schoolEmail}

We will contact you shortly to schedule a counselling session.

Best regards,
${schoolName} Admissions Team
`.trim();

  // In development, log message instead of sending
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('WHATSAPP SERVICE (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: 'WhatsApp message sent successfully (dev mode)',
      mockMessage: message,
      to: data.to
    };
  }

  // In production, send via Twilio WhatsApp API
  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappFrom = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('⚠️  Twilio credentials missing or invalid (SID must start with AC). WhatsApp will not be sent.');
        console.warn('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables to enable WhatsApp.');
      } else {
        const client = twilio(accountSid, authToken);
        const contentSid = process.env.TWILIO_ENQUIRY_SID;

        if (contentSid) {
          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              "1": schoolName,
              "2": data.parentName,
              "3": data.studentName,
              "4": data.tokenId,
              "5": documentsList,
              "6": "https://brochure-magnum-solutions.tiiny.site",
              "7": schoolPhone,
              "8": schoolEmail
            }),
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        } else {
          await client.messages.create({
            body: message,
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        }
        console.log(`[PROD] WhatsApp enquiry message sent successfully to ${data.to}`);
      }
    } catch (error) {
      console.error('Error sending WhatsApp via Twilio:', error);
    }
  }

  return {
    success: true,
    message: 'WhatsApp message sent successfully'
  };
}

/**
 * Send slot confirmation WhatsApp
 */
export async function sendSlotConfirmationWhatsApp(data: {
  to: string;
  tokenId: string;
  studentName: string;
  slotDate: string;
  slotTime: string;
  location: string;
}): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';

  const message = `
🎓 *Counselling Slot Confirmed - ${schoolName}*

Dear Parent,

Your counselling session has been scheduled!

📋 *Token ID:* ${data.tokenId}
👤 *Student:* ${data.studentName}
📅 *Date:* ${data.slotDate}
⏰ *Time:* ${data.slotTime}
📍 *Location:* ${data.location}

Please bring all required documents for verification.

A calendar invite has been sent to your email.

Best regards,
${schoolName} Admissions Team
`.trim();

  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('WHATSAPP SLOT CONFIRMATION (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: 'Slot confirmation WhatsApp sent (dev mode)',
      mockMessage: message,
      to: data.to
    };
  }

  // In production, send via Twilio WhatsApp API
  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappFrom = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('⚠️  Twilio credentials missing or invalid (SID must start with AC). WhatsApp will not be sent.');
      } else {
        const client = twilio(accountSid, authToken);
        const contentSid = process.env.TWILIO_SLOT_CONFIRMATION_SID;

        if (contentSid) {
          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              "1": schoolName,
              "2": data.tokenId,
              "3": data.studentName,
              "4": data.slotDate,
              "5": data.slotTime,
              "6": data.location
            }),
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        } else {
          await client.messages.create({
            body: message,
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        }
        console.log(`[PROD] Slot confirmation WhatsApp sent successfully to ${data.to}`);
      }
    } catch (error) {
      console.error('Error sending Slot WhatsApp via Twilio:', error);
    }
  }

  return {
    success: true,
    message: 'Slot confirmation WhatsApp sent'
  };
}

/**
 * Send slot reminder WhatsApp (T-1, T-3)
 */
export async function sendSlotReminderWhatsApp(data: {
  to: string;
  tokenId: string;
  studentName: string;
  slotDate: string;
  slotTime: string;
  reminderDay: number; // 1 or 3
}): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';

  const message = `
🔔 *Reminder: Counselling Session at ${schoolName}*

Dear Parent,

This is a reminder for ${data.studentName}'s counselling session scheduled for ${data.reminderDay === 1 ? 'tomorrow' : `in ${data.reminderDay} days`}.

📋 *Token ID:* ${data.tokenId}
📅 *Date:* ${data.slotDate}
⏰ *Time:* ${data.slotTime}

Please ensure you have uploaded all required documents in the parent portal before your visit.

We look forward to meeting you!

Best regards,
${schoolName} Admissions Team
`.trim();

  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log(`WHATSAPP REMINDER T-${data.reminderDay} (MOCK MODE)`);
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: `Reminder T-${data.reminderDay} WhatsApp sent (dev mode)`,
      mockMessage: message,
      to: data.to
    };
  }

  // In production
  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappFrom = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn(`⚠️  Twilio credentials missing or invalid for T-${data.reminderDay} reminder.`);
      } else {
        const client = twilio(accountSid, authToken);
        const contentSid = process.env.TWILIO_REMINDER_SID;
        const reminderPoint = data.reminderDay === 1 ? 'tomorrow' : `in ${data.reminderDay} days`;

        // Dynamic notes based on the reminder day
        const reminderNotes: Record<number, string> = {
          1: "We look forward to meeting you tomorrow! Please ensure all documents are uploaded to the portal to avoid delays.",
          2: "Your session is just 2 days away. Have you uploaded all the required documents yet?",
          3: "This is a reminder for your session in 3 days. We look forward to seeing you at the school.",
          4: "Friendly reminder: Your counselling session is scheduled for 4 days from now.",
          5: "Early reminder: You have a counselling session booked in 5 days. See you soon!"
        };

        const docsNote = reminderNotes[data.reminderDay] || 'Please ensure you have uploaded all required documents in the parent portal before your visit.';

        if (contentSid) {
          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              "1": schoolName,
              "2": data.studentName,
              "3": reminderPoint,
              "4": data.tokenId,
              "5": data.slotDate,
              "6": data.slotTime,
              "7": docsNote
            }),
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        } else {
          // Re-construct message with dynamic note for non-template fallback
          const fallbackMessage = `
🔔 *Reminder: Counselling Session at ${schoolName}*

Dear Parent,

This is a reminder for ${data.studentName}'s counselling session scheduled for ${reminderPoint}.

📋 *Token ID:* ${data.tokenId}
📅 *Date:* ${data.slotDate}
⏰ *Time:* ${data.slotTime}

${docsNote}

Best regards,
${schoolName} Admissions Team
`.trim();

          await client.messages.create({
            body: fallbackMessage,
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        }
      }
    } catch (error) {
      console.error(`Error sending T-${data.reminderDay} WhatsApp:`, error);
    }
  }

  return {
    success: true,
    message: `Reminder T-${data.reminderDay} WhatsApp sent`
  };
}

/**
 * Send no-show reschedule WhatsApp
 */
export async function sendNoShowRescheduleWhatsApp(data: {
  to: string;
  tokenId: string;
  studentName: string;
  slotDate: string;
  slotTime: string;
}): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';

  const message = `
⚠️ *Update: No-Show & Auto-Reschedule - ${schoolName}*

Dear Parent,

We missed you at ${data.studentName}'s counselling session today. As per school policy, we have automatically rescheduled your session to the next available slot:

📋 *Token ID:* ${data.tokenId}
📅 *New Date:* ${data.slotDate}
⏰ *New Time:* ${data.slotTime}

Please note that this is a *one-time auto-reschedule*. If you miss this session as well, your application will be automatically rejected.

Best regards,
${schoolName} Admissions Team
`.trim();

  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('WHATSAPP NO-SHOW RESCHEDULE (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: 'No-show reschedule WhatsApp sent (dev mode)',
      mockMessage: message,
      to: data.to
    };
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappFrom = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('⚠️  Twilio credentials missing or invalid for No-Show reminder.');
      } else {
        const client = twilio(accountSid, authToken);
        const contentSid = process.env.TWILIO_NOSHOW_RESCHEDULE_SID;

        if (contentSid) {
          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              "1": schoolName,
              "2": data.studentName,
              "3": data.tokenId,
              "4": data.slotDate,
              "5": data.slotTime
            }),
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        } else {
          await client.messages.create({
            body: message,
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        }
        console.log(`[PROD] No-show reschedule WhatsApp sent successfully to ${data.to}`);
      }
    } catch (error) {
      console.error('Error sending No-Show WhatsApp:', error);
    }
  }

  return { success: true, message: 'No-show reschedule WhatsApp sent' };
}

/**
 * Send status update WhatsApp (Confirmed, Waitlisted, Rejected)
 */
export async function sendStatusUpdateWhatsApp(data: {
  to: string;
  tokenId: string;
  studentName: string;
  status: 'confirmed' | 'waitlisted' | 'rejected' | 'approved';
}): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';

  let statusText = '';
  let colorEmoji = '';
  let additionalInfo = '';

  switch (data.status) {
    case 'confirmed':
    case 'approved':
      statusText = 'ADMISSION CONFIRMED';
      colorEmoji = '✅';
      additionalInfo = 'Congratulations! Your admission has been confirmed. Our team will contact you regarding the next steps and fee payment.';
      break;
    case 'waitlisted':
      statusText = 'WAITLISTED';
      colorEmoji = '⏳';
      additionalInfo = 'Your application has been moved to the waitlist. We will notify you if a seat becomes available.';
      break;
    case 'rejected':
      statusText = 'REJECTED';
      colorEmoji = '❌';
      additionalInfo = 'We regret to inform you that we are unable to proceed with your admission at this time.';
      break;
  }

  const message = `
${colorEmoji} *Admission Status Updated - ${schoolName}*

Dear Parent,

The status for ${data.studentName}'s admission application has been updated:

📋 *Token ID:* ${data.tokenId}
📊 *New Status:* ${statusText}

${additionalInfo}

Best regards,
${schoolName} Admissions Team
`.trim();

  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('WHATSAPP STATUS UPDATE (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: 'Status update WhatsApp sent (dev mode)',
      mockMessage: message,
      to: data.to
    };
  }

  // Production logic (abbreviated for brevity, similar to others)
  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappFrom = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('⚠️  Twilio credentials missing or invalid for Status update.');
      } else {
        const client = twilio(accountSid, authToken);
        const contentSid = process.env.TWILIO_STATUS_UPDATE_SID;

        if (contentSid) {
          // Map internal status to template display text
          let templateStatus = '';
          switch (data.status) {
            case 'confirmed':
            case 'approved': templateStatus = 'ADMISSION CONFIRMED'; break;
            case 'waitlisted': templateStatus = 'WAITLISTED'; break;
            case 'rejected': templateStatus = 'REJECTED'; break;
          }

          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              "1": schoolName,
              "2": data.studentName,
              "3": data.tokenId,
              "4": templateStatus
            }),
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        } else {
          await client.messages.create({
            body: message,
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        }
        console.log(`[PROD] Status update WhatsApp sent successfully to ${data.to}`);
      }
    } catch (error) {
      console.error('Error sending Status WhatsApp:', error);
    }
  }

  return {
    success: true,
    message: 'Status update WhatsApp sent'
  };
}
/**
 * Send automated waitlist reminder WhatsApp
 */
export async function sendWaitlistReminderWhatsApp(data: {
  to: string;
  tokenId: string;
  studentName: string;
}): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';

  const message = `
⏳ *Waitlist Update - ${schoolName}*

Dear Parent,

This is a reminder that the application for ${data.studentName} is still on the waitlist. 

📋 *Token ID:* ${data.tokenId}

We will notify you immediately once a seat becomes available for the selected grade.

Best regards,
${schoolName} Admissions Team
`.trim();

  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('WHATSAPP WAITLIST REMINDER (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: 'Waitlist reminder sent (dev mode)',
      mockMessage: message,
      to: data.to
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.WHATSAPP_NUMBER;

  if (accountSid && authToken && accountSid.startsWith('AC') && whatsappFrom) {
    try {
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);

      // Support for Content SID if available
      const contentSid = process.env.TWILIO_WAITLIST_SID;

      if (contentSid) {
        await client.messages.create({
          contentSid: contentSid,
          contentVariables: JSON.stringify({
            "1": schoolName,
            "2": data.studentName,
            "3": data.tokenId
          }),
          from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
          to: normalizeWhatsAppNumber(data.to)
        });
      } else {
        await client.messages.create({
          body: message,
          from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
          to: normalizeWhatsAppNumber(data.to)
        });
      }
    } catch (error) {
      console.error(`Error sending waitlist reminder WhatsApp:`, error);
      return { success: false, message: 'Twilio error' };
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Twilio credentials missing or invalid for waitlist reminder.');
  }

  return { success: true, message: 'Waitlist reminder sent' };
}



/**
 * Send school-initiated slot reschedule WhatsApp
 */
export async function sendSlotRescheduleWhatsApp(data: {
  to: string;
  tokenId: string;
  studentName: string;
  slotDate: string;
  slotTime: string;
  reason?: string;
}): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'New Era High School';

  const message = `
⚠️ *Update: Appointment Rescheduled - ${schoolName}*

Dear Parent,

Your counselling session for ${data.studentName} has been rescheduled.

📋 *Token ID:* ${data.tokenId}
📅 *New Date:* ${data.slotDate}
⏰ *New Time:* ${data.slotTime}
ℹ️ *Reason:* ${data.reason || 'Administrative adjustment'}

We apologize for any inconvenience caused. We look forward to meeting you!

Best regards,
${schoolName} Admissions Team
`.trim();

  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('WHATSAPP SLOT RESCHEDULE (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`To: ${data.to}`);
    console.log('Message:');
    console.log(message);
    console.log('========================================');

    return {
      success: true,
      message: 'Reschedule WhatsApp sent (dev mode)',
      mockMessage: message,
      to: data.to
    };
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappFrom = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
        console.warn('⚠️  Twilio credentials missing or invalid for Reschedule notification.');
      } else {
        const client = twilio(accountSid, authToken);
        const contentSid = process.env.TWILIO_MANUAL_RESCHEDULE_SID;

        if (contentSid) {
          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              "1": schoolName,
              "2": data.studentName,
              "3": data.tokenId,
              "4": data.slotDate,
              "5": data.slotTime,
              "6": data.reason || 'Administrative adjustment'
            }),
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        } else {
          await client.messages.create({
            body: message,
            from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
            to: normalizeWhatsAppNumber(data.to)
          });
        }
        console.log(`[PROD] Manual reschedule WhatsApp sent successfully to ${data.to}`);
      }
    } catch (error) {
      console.error('Error sending Reschedule WhatsApp:', error);
    }
  }

  return { success: true, message: 'Reschedule WhatsApp sent' };
}
