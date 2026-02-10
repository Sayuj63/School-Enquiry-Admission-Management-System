import dotenv from 'dotenv';
import path from 'path';
import twilio from 'twilio';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886';
// Use the number provided in previous logs or a placeholder
const to = process.argv[2] || 'whatsapp:+918097145791';

if (!accountSid || !authToken) {
    console.error('❌ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env');
    process.exit(1);
}

const client = twilio(accountSid, authToken);

const templates = [
    {
        name: '1. Enquiry Confirmation',
        sid: process.env.TWILIO_ENQUIRY_SID,
        variables: {
            "1": "New Era High School",
            "2": "Adarsh Singh",
            "3": "Aryan Singh",
            "4": "ENQ-2026-TEST",
            "5": "Birth Certificate, Aadhar Card, Photo",
            "6": "https://brochure-magnum-solutions.tiiny.site",
            "7": "+91 98765 43210",
            "8": "admissions@nes.edu.in"
        }
    },
    {
        name: '2. Slot Confirmation',
        sid: process.env.TWILIO_SLOT_CONFIRMATION_SID,
        variables: {
            "1": "New Era High School",
            "2": "ENQ-2026-TEST",
            "3": "Aryan Singh",
            "4": "Friday, 13 Feb",
            "5": "10:30 AM",
            "6": "School Main Office"
        }
    },
    {
        name: '3. No-Show Auto-Reschedule',
        sid: process.env.TWILIO_NOSHOW_RESCHEDULE_SID,
        variables: {
            "1": "New Era High School",
            "2": "Aryan Singh",
            "3": "ENQ-2026-TEST",
            "4": "Monday, 16 Feb",
            "5": "11:00 AM"
        }
    },
    {
        name: '4. Manual Reschedule',
        sid: process.env.TWILIO_MANUAL_RESCHEDULE_SID,
        variables: {
            "1": "New Era High School",
            "2": "Aryan Singh",
            "3": "ENQ-2026-TEST",
            "4": "Tuesday, 17 Feb",
            "5": "09:00 AM",
            "6": "Administrative adjustment"
        }
    },
    {
        name: '5. Status Update',
        sid: process.env.TWILIO_STATUS_UPDATE_SID,
        variables: {
            "1": "New Era High School",
            "2": "Aryan Singh",
            "3": "ENQ-2026-TEST",
            "4": "ADMISSION CONFIRMED"
        }
    },
    {
        name: '6. Slot Reminder',
        sid: process.env.TWILIO_REMINDER_SID,
        variables: {
            "1": "New Era High School",
            "2": "Aryan Singh",
            "3": "tomorrow",
            "4": "ENQ-2026-TEST",
            "5": "Friday, 13 Feb",
            "6": "10:30 AM",
            "7": "Please ensure all original documents are present."
        }
    },
    {
        name: '7. Waitlist Reminder',
        sid: process.env.TWILIO_WAITLIST_SID,
        variables: {
            "1": "New Era High School",
            "2": "Aryan Singh",
            "3": "ENQ-2026-TEST"
        }
    }
];

// Helper to sleep between messages
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    console.log(`\n🚀 Starting Twilio SID Tests for ${to}`);
    console.log(`----------------------------------------`);

    for (let i = 0; i < templates.length; i++) {
        const template = templates[i];

        if (!template.sid) {
            console.warn(`⚠️  Skipping ${template.name}: SID not found in .env`);
            continue;
        }

        // Add 5s delay between messages (except the first one)
        if (i > 0) {
            console.log(`⏳ Waiting 5 seconds to avoid spam filters...`);
            await sleep(5000);
        }

        try {
            console.log(`📤 Sending ${template.name}...`);
            const message = await client.messages.create({
                from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
                to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
                contentSid: template.sid,
                contentVariables: JSON.stringify(template.variables)
            });
            console.log(`✅ Success! SID: ${message.sid}`);
        } catch (error: any) {
            console.error(`❌ Failed ${template.name}: ${error.message}`);
        }
        console.log(`----------------------------------------`);
    }

    console.log(`\n🏁 Tests completed.\n`);
}

runTests();
