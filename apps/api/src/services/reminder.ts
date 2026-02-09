import { CounsellingSlot, SlotBooking, Enquiry, NotificationSettings, Admission } from '../models';
import { sendSlotReminderWhatsApp, sendWaitlistReminderWhatsApp } from './whatsapp';

/**
 * Check and send automated WhatsApp reminders for counselling sessions
 */
export async function checkAndSendReminders() {
    try {
        const settings = await NotificationSettings.findOne({ key: 'notifications' });
        if (!settings || !settings.whatsappEnabled || !settings.reminderDays || settings.reminderDays.length === 0) {
            return;
        }

        // Find all slots in future (30 days window)
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() + 30);

        const slots = await CounsellingSlot.find({
            date: { $gt: new Date(), $lt: dateLimit },
            status: { $ne: 'disabled' }
        });

        console.log(`[ReminderService] Checking reminders for ${slots.length} upcoming slots...`);

        for (const slot of slots) {
            // Calculate days difference
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const slotDay = new Date(slot.date);
            slotDay.setHours(0, 0, 0, 0);

            const diffTime = slotDay.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // If this is a configured reminder day
            if (settings.reminderDays.includes(diffDays)) {
                // Find bookings for this slot
                const bookings = await SlotBooking.find({
                    slotId: slot._id,
                    remindersSent: { $ne: diffDays } // Only if reminder for THIS day not already sent
                });

                if (bookings.length === 0) continue;

                console.log(`[ReminderService] Found ${bookings.length} parents to remind for Slot ${slot.date.toLocaleDateString()} (T-${diffDays})`);

                for (const booking of bookings) {
                    const enquiry = await Enquiry.findById(booking.enquiryId);
                    if (!enquiry || !enquiry.mobile) continue;

                    const dateFormatted = slot.date.toLocaleDateString('en-IN', {
                        weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata'
                    });

                    const result = await sendSlotReminderWhatsApp({
                        to: enquiry.mobile || '',
                        tokenId: enquiry.tokenId || 'N/A',
                        studentName: enquiry.childName || 'Student',
                        slotDate: dateFormatted,
                        slotTime: `${slot.startTime} - ${slot.endTime}`,
                        reminderDay: diffDays
                    });

                    if (result.success) {
                        // Mark as sent
                        booking.remindersSent.push(diffDays);
                        await booking.save();
                    }
                }
            }
        }
    } catch (error) {
        console.error('[ReminderService] Error:', error);
    }
}

/**
 * Check and send waitlist reminders (3.5.2)
 */
export async function checkWaitlistReminders() {
    try {
        const settings = await NotificationSettings.findOne({ key: 'notifications' });
        if (!settings || !settings.whatsappEnabled || !settings.waitlistReminderDays || settings.waitlistReminderDays.length === 0) {
            return;
        }

        // Find all waitlisted admissions (Parent-initiated only per 3.5.2)
        const waitlistedAdmissions = await Admission.find({
            status: 'waitlisted',
            waitlistDate: { $exists: true },
            waitlistType: 'parent'
        });

        console.log(`[ReminderService] Checking waitlist reminders for ${waitlistedAdmissions.length} applications...`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const adm of waitlistedAdmissions) {
            if (!adm.waitlistDate) continue;

            const waitDay = new Date(adm.waitlistDate);
            waitDay.setHours(0, 0, 0, 0);

            const diffTime = today.getTime() - waitDay.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // If this is a configured reminder day (T + diffDays)
            if (settings.waitlistReminderDays.includes(diffDays) && !adm.waitlistRemindersSent.includes(diffDays)) {
                console.log(`[WaitlistReminder] Sending T+${diffDays} reminder to ${adm.studentName} (${adm.mobile})`);

                const result = await sendWaitlistReminderWhatsApp({
                    to: adm.mobile,
                    tokenId: adm.tokenId,
                    studentName: adm.studentName,
                    template: settings.waitlistReminderTemplate
                });

                if (result.success) {
                    adm.waitlistRemindersSent.push(diffDays);
                    await adm.save();
                }
            }
        }
    } catch (error) {
        console.error('[WaitlistReminderService] Error:', error);
    }
}

/**
 * Start the background reminder job
 */
export function startReminderJob() {
    console.log('[ReminderService] Initializing background reminder job...');

    // Run once at startup
    checkAndSendReminders();
    checkWaitlistReminders();

    // Run every 4 hours (240 minutes)
    setInterval(() => {
        checkAndSendReminders();
        checkWaitlistReminders();
    }, 4 * 60 * 60 * 1000);
}
