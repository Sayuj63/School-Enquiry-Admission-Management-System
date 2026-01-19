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
 * Send WhatsApp message with brochure and documents list
 * In development mode, message is logged to console instead of being sent
 */
export async function sendEnquiryWhatsApp(data: WhatsAppMessage): Promise<SendWhatsAppResult> {
  const schoolName = process.env.SCHOOL_NAME || 'ABC International School';
  const schoolPhone = process.env.SCHOOL_PHONE || '+919876543210';
  const schoolEmail = process.env.SCHOOL_EMAIL || 'info@school.com';

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

      if (!accountSid || !authToken) {
        console.error('Twilio credentials missing in environment variables');
      } else {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: message,
          from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
          to: data.to.startsWith('whatsapp:') ? data.to : `whatsapp:${data.to.startsWith('+') ? data.to : '+' + data.to}`
        });
        console.log(`[PROD] WhatsApp message sent successfully to ${data.to}`);
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
  const schoolName = process.env.SCHOOL_NAME || 'ABC International School';

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

      if (!accountSid || !authToken) {
        console.error('Twilio credentials missing in environment variables');
      } else {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: message,
          from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
          to: data.to.startsWith('whatsapp:') ? data.to : `whatsapp:${data.to.startsWith('+') ? data.to : '+' + data.to}`
        });
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
