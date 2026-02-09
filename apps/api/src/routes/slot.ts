import { Router, Response } from 'express';
import { CounsellingSlot, SlotBooking, Admission, SlotSettings, Enquiry } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  sendSlotConfirmationWhatsApp,
  sendSlotRescheduleWhatsApp,
  sendParentCalendarInvite,
  sendPrincipalCalendarInvite
} from '../services';

const router: Router = Router();

const SLOT_CAPACITY = 3;
const DEFAULT_LOCATION = 'New Era High School- Dombivli (East)';

/**
 * POST /api/slots
 * Create a new counselling slot (admin only)
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, startTime, endTime, capacity } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Date, start time, and end time are required'
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time'
      });
    }

    // Calculate duration in minutes
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

    if (durationMinutes < 30) {
      return res.status(400).json({
        success: false,
        error: 'Counselling slots must be at least 30 minutes long'
      });
    }

    const [year, month, day] = date.split('-').map(Number)
    const slotDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

    // Check if slot is in the past (date + time)
    const now = new Date();
    // Use local-ish comparison or UTC comparison carefully.
    // Given the system uses simple time strings like "10:00", we should check against current time.
    const slotStartTimeUTC = new Date(Date.UTC(year, month - 1, day, startH, startM));

    const nowUTC = new Date(); // Or if the school is specifically IST, convert now to IST

    // To be safe and simple, let's compare the combined date and time
    // We'll use the IST conversion logic already present in the "available" route if needed,
    // but for creation, usually the server time or a specific timezone is intended.
    // Let's use the provided UTC-based slotDate logic and extend it.

    const slotDateTime = new Date(year, month - 1, day, startH, startM);
    if (slotDateTime < now) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create a slot in the past'
      });
    }

    // Check for any overlapping slot (not just exact start time)
    const overlappingSlot = await CounsellingSlot.findOne({
      date: slotDate,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    })

    if (overlappingSlot) {
      return res.status(400).json({
        success: false,
        error: `A slot already exists or overlaps with this time range (${overlappingSlot.startTime} - ${overlappingSlot.endTime})`
      });
    }

    let slotCapacity = capacity;
    if (!slotCapacity) {
      const settings = await SlotSettings.findOne({ key: 'slots' });
      slotCapacity = settings ? settings.parentsPerSlot : 3;
    }

    const slot = await CounsellingSlot.create({
      date: slotDate,
      startTime,
      endTime,
      capacity: slotCapacity,
      bookedCount: 0,
      status: 'available'
    });

    res.status(201).json({
      success: true,
      data: slot
    });
  } catch (error) {
    console.error('Create slot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create slot'
    });
  }
});

/**
 * GET /api/slots
 * List all slots (admin only)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const status = req.query.status as string;

    const query: any = {};

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setUTCHours(0, 0, 0, 0);
        query.date.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setUTCHours(23, 59, 59, 999);
        query.date.$lte = toDate;
      }
    }

    if (status) {
      query.status = status;
    }

    const slots = await CounsellingSlot.find(query).sort({ date: 1, startTime: 1 });

    // Get booking counts for each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        const bookings = await SlotBooking.find({ slotId: slot._id }).populate('admissionId');

        // Dynamically calculate total bookings to ensure UI accuracy
        const totalBookings = bookings.length;

        // Sync DB if out of sync (denormalization maintenance)
        if (slot.bookedCount !== totalBookings) {
          slot.bookedCount = totalBookings;
          await slot.save();
        }

        return {
          ...slot.toObject(),
          bookedCount: totalBookings,
          bookings
        };
      })
    );

    res.json({
      success: true,
      data: slotsWithBookings
    });
  } catch (error) {
    console.error('List slots error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch slots'
    });
  }
});

/**
 * GET /api/slots/available
 * Get available slots for booking
 */
router.get('/available', async (req, res: Response) => {
  try {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const slots = await CounsellingSlot.find({
      date: { $gte: todayDate },
      status: 'available'
    }).sort({ date: 1, startTime: 1 });

    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    const todayIST = new Date(istNow);
    todayIST.setHours(0, 0, 0, 0);

    const currentTimeStr = `${String(istNow.getHours()).padStart(2, '0')}:${String(istNow.getMinutes()).padStart(2, '0')}`;

    const filteredSlots = slots.filter(slot => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);

      // If slot is for a future date, it's available
      if (slotDate > todayIST) return true;

      // If slot is for today, check start time
      if (slotDate.getTime() === todayIST.getTime()) {
        return slot.startTime > currentTimeStr;
      }

      return false;
    });

    res.json({
      success: true,
      data: filteredSlots
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available slots'
    });
  }
});

/**
 * POST /api/slots/generate-bulk
 * Generate slots in bulk based on availability
 */
router.post('/generate-bulk', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { availability } = req.body; // Array of { date, startTime, endTime }

    if (!availability || !Array.isArray(availability)) {
      return res.status(400).json({ success: false, error: 'Availability data is required' });
    }

    const settings = await SlotSettings.findOne({ key: 'slots' });
    const duration = settings?.slotDuration || 30;
    const gap = settings?.gapBetweenSlots || 0;
    const capacity = settings?.parentsPerSlot || 3;
    const maxSlots = settings?.maxSlotsPerDay || 10;

    const createdSlots = [];

    for (const period of availability) {
      const { date, startTime, endTime } = period;

      if (startTime >= endTime) {
        continue; // Skip invalid ranges
      }

      const [year, month, day] = date.split('-').map(Number);
      const slotDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

      // Skip past dates entirely
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (new Date(year, month - 1, day) < now) {
        continue;
      }

      let currentMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      // If it's today, start from current time if startTime is in the past
      const today = new Date();
      if (year === today.getFullYear() && (month - 1) === today.getMonth() && day === today.getDate()) {
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        if (currentMinutes < nowMinutes) {
          currentMinutes = Math.ceil(nowMinutes / duration) * duration;
        }
      }

      let totalSlotsForDay = await CounsellingSlot.countDocuments({ date: slotDate });

      while (currentMinutes + duration <= endMinutes && totalSlotsForDay < maxSlots) {
        const slotStartTime = minutesToTime(currentMinutes);
        const slotEndTime = minutesToTime(currentMinutes + duration);

        // Check for overlap
        const overlappingSlot = await CounsellingSlot.findOne({
          date: slotDate,
          $or: [
            {
              startTime: { $lt: slotEndTime },
              endTime: { $gt: slotStartTime }
            }
          ]
        });

        if (!overlappingSlot) {
          const slot = await CounsellingSlot.create({
            date: slotDate,
            startTime: slotStartTime,
            endTime: slotEndTime,
            capacity,
            bookedCount: 0,
            status: 'available'
          });
          createdSlots.push(slot);
          totalSlotsForDay++;
        }

        currentMinutes += duration + gap;
      }
    }

    res.json({ success: true, count: createdSlots.length, data: createdSlots });
  } catch (error) {
    console.error('Bulk generate slots error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate slots' });
  }
});

/**
 * POST /api/slots/generate-saturday-defaults
 * Generate default slots for 2nd & 4th Saturdays of current and next month
 */
router.post('/generate-saturday-defaults', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await SlotSettings.findOne({ key: 'slots' });
    const maxSlots = settings?.maxSlotsPerDay || 3;
    const capacity = settings?.parentsPerSlot || 3;
    const duration = settings?.slotDuration || 30;
    const gap = settings?.gapBetweenSlots || 0;

    const now = new Date();
    const datesToProcess = [];

    // Check current month and next month
    for (let m = 0; m < 2; m++) {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + m;

      // Find all Saturdays in the month
      const saturdays = [];
      const date = new Date(Date.UTC(year, month, 1));
      while (date.getUTCMonth() === (month % 12)) {
        if (date.getUTCDay() === 6) { // 6 is Saturday
          saturdays.push(new Date(date));
        }
        date.setUTCDate(date.getUTCDate() + 1);
      }

      // 2nd and 4th Saturdays
      if (saturdays[1]) datesToProcess.push(saturdays[1]);
      if (saturdays[3]) datesToProcess.push(saturdays[3]);
    }

    const createdSlots = [];
    const startTimeStr = '14:00';
    const endTimeStr = '16:00';

    for (const slotDate of datesToProcess) {
      // Check if in the past
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (slotDate < today) continue;

      let currentMinutes = timeToMinutes(startTimeStr);
      const endMinutes = timeToMinutes(endTimeStr);

      // Fix: Count existing slots for this day to avoid releasing more than maxSlots total
      const existingCount = await CounsellingSlot.countDocuments({ date: slotDate });
      let totalSlotsForDay = existingCount;

      while (currentMinutes + duration <= endMinutes && totalSlotsForDay < maxSlots) {
        const slotStartTime = minutesToTime(currentMinutes);
        const slotEndTime = minutesToTime(currentMinutes + duration);

        // Check for overlap
        const overlappingSlot = await CounsellingSlot.findOne({
          date: slotDate,
          $or: [
            {
              startTime: { $lt: slotEndTime },
              endTime: { $gt: slotStartTime }
            }
          ]
        });

        if (!overlappingSlot) {
          const slot = await CounsellingSlot.create({
            date: slotDate,
            startTime: slotStartTime,
            endTime: slotEndTime,
            capacity,
            bookedCount: 0,
            status: 'available'
          });
          createdSlots.push(slot);
          totalSlotsForDay++;
        }

        currentMinutes += duration + gap;
      }
    }

    if (createdSlots.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: 'Saturday slots for this period are already released or no new slots needed.',
        data: []
      });
    }

    res.json({
      success: true,
      count: createdSlots.length,
      message: `Successfully generated ${createdSlots.length} new Saturday slots.`,
      data: createdSlots
    });
  } catch (error) {
    console.error('Generate Saturday slots error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate Saturday slots' });
  }
});

/**
 * GET /api/slots/booking/mobile/:mobile
 * Check if a parent has an existing booking across any of their applications
 */
router.get('/booking/mobile/:mobile', async (req, res: Response) => {
  try {
    const { mobile } = req.params;

    // Find any enquiry or admission with this mobile
    const enquiries = await Enquiry.find({ mobile }).select('_id');
    const admissions = await Admission.find({ mobile }).select('_id');

    const enquiryIds = enquiries.map(e => e._id);
    const admissionIds = admissions.map(a => a._id);

    // Find a booking that links to any of these
    const booking = await SlotBooking.findOne({
      $or: [
        { enquiryId: { $in: enquiryIds } },
        { admissionId: { $in: admissionIds } }
      ]
    }).populate('slotId');

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Lookup booking by mobile error:', error);
    res.status(500).json({ success: false, error: 'Failed to lookup booking' });
  }
});

/**
 * GET /api/slots/reschedule-options/:tokenId
 * Returns slots that a parent is allowed to move to (Requirement 2.3)
 * Slots must be released AFTER the booking date and be EARLIER than current slot
 */
router.get('/reschedule-options/:tokenId', async (req, res: Response) => {
  try {
    const { tokenId } = req.params;
    const booking = await SlotBooking.findOne({ tokenId }).populate('slotId');

    if (!booking || !booking.slotId) {
      return res.json({ success: true, data: [], message: 'No existing active booking found' });
    }

    const currentSlot = booking.slotId as any;
    const bookingTime = booking.bookedAt;

    // Find slots that meet Requirement 2.3
    const allAvailable = await CounsellingSlot.find({
      status: 'available',
      createdAt: { $gt: bookingTime } // Released AFTER parent booked
    });

    const eligibleSlots = allAvailable.filter(slot => {
      const slotDate = new Date(slot.date);
      const currDate = new Date(currentSlot.date);

      if (slotDate < currDate) return true;
      if (slotDate.getTime() === currDate.getTime()) {
        return timeToMinutes(slot.startTime) < timeToMinutes(currentSlot.startTime);
      }
      return false;
    });

    res.json({ success: true, data: eligibleSlots });
  } catch (error) {
    console.error('Fetch reschedule options error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch options' });
  }
});

/**
 * POST /api/slots/reschedule-parent/:tokenId
 * Perform reschedule if Requirement 2.3 is met
 */
router.post('/reschedule-parent/:tokenId', async (req, res: Response) => {
  try {
    const { tokenId } = req.params;
    const { slotId: newSlotId } = req.body;

    const booking = await SlotBooking.findOne({ tokenId }).populate('slotId');
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const currentSlot = booking.slotId as any;
    const newSlot = await CounsellingSlot.findById(newSlotId);
    if (!newSlot) return res.status(404).json({ success: false, error: 'New slot not found' });

    // VERIFY REQUIREMENT 2.3
    if (newSlot.status !== 'available') {
      return res.status(400).json({ success: false, error: 'Selected slot is no longer available' });
    }

    if (newSlot.createdAt <= booking.bookedAt) {
      return res.status(400).json({ success: false, error: 'Requirement 2.3: You can only move to slots released after your initial booking.' });
    }

    const slotDate = new Date(newSlot.date);
    const currDate = new Date(currentSlot.date);
    const isEarlier = slotDate < currDate || (slotDate.getTime() === currDate.getTime() && timeToMinutes(newSlot.startTime) < timeToMinutes(currentSlot.startTime));

    if (!isEarlier) {
      return res.status(400).json({ success: false, error: 'Requirement 2.3: You can only move to an earlier slot.' });
    }

    // PERFORM RESCHEDULE (Logic similar to /book)
    // 1. Find all related bookings for this parent
    const parentBookings = await SlotBooking.find({ parentEmail: booking.parentEmail });

    // 2. Decrement old slot(s) for each booking being moved
    for (const pb of parentBookings) {
      const oldSlot = await CounsellingSlot.findById(pb.slotId);
      if (oldSlot) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        if (oldSlot.bookedCount < oldSlot.capacity && oldSlot.status === 'full') {
          oldSlot.status = 'available';
        }
        await oldSlot.save();
      }
    }

    // 3. Increment new slot by total number of moved bookings
    newSlot.bookedCount += parentBookings.length;
    if (newSlot.bookedCount >= newSlot.capacity) {
      newSlot.status = 'full';
    }
    await newSlot.save();

    // 4. Update all bookings
    for (const b of parentBookings) {
      b.slotId = newSlot._id as any;
      b.bookedAt = new Date();
      await b.save();
    }

    // Send notifications (WhatsApp + Email + Calendar Invites)
    const slotDateFormatted = newSlot.date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    const admission = await Admission.findOne({ tokenId });
    if (admission) {
      // Send WhatsApp reschedule message
      sendSlotRescheduleWhatsApp({
        to: admission.mobile,
        tokenId: admission.tokenId,
        studentName: admission.studentName,
        slotDate: slotDateFormatted,
        slotTime: `${newSlot.startTime} - ${newSlot.endTime}`,
        reason: 'Parent-initiated reschedule'
      }).catch((err) => console.error('WhatsApp reschedule notification error:', err));

      // Send parent calendar invite (as reschedule)
      sendParentCalendarInvite({
        parentEmail: admission.email,
        parentName: admission.parentName,
        studentName: admission.studentName,
        tokenId: admission.tokenId,
        slotDate: newSlot.date,
        slotStartTime: newSlot.startTime,
        slotEndTime: newSlot.endTime,
        location: DEFAULT_LOCATION,
        isReschedule: true
      }).catch((err) => console.error('Parent reschedule calendar invite error:', err));

      // Send principal calendar invite (as reschedule)
      sendPrincipalCalendarInvite({
        studentName: admission.studentName,
        parentName: admission.parentName,
        tokenId: admission.tokenId,
        slotDate: newSlot.date,
        slotStartTime: newSlot.startTime,
        slotEndTime: newSlot.endTime,
        location: DEFAULT_LOCATION,
        isReschedule: true
      }).catch((err) => console.error('Principal reschedule calendar invite error:', err));
    }

    res.json({ success: true, message: `Rescheduled ${parentBookings.length} applications successfully` });
  } catch (error) {
    console.error('Reschedule parent error:', error);
    res.status(500).json({ success: false, error: 'Failed to reschedule' });
  }
});
/**
 * POST /api/slots/book-parent/:tokenId
 * Allow parents to book their first slot after being promoted from waitlist
 */
router.post('/book-parent/:tokenId', async (req: AuthRequest, res: Response) => {
  try {
    const { tokenId } = req.params;
    const { slotId } = req.body;

    if (!slotId) {
      return res.status(400).json({ success: false, error: 'Slot selection is required' });
    }

    // 1. Verify Admission and Status
    const admission = await Admission.findOne({ tokenId });
    if (!admission) return res.status(404).json({ success: false, error: 'Admission record not found' });

    // Ensure they don't already have a booking for THIS admission
    const existing = await SlotBooking.findOne({ admissionId: admission._id });
    if (existing) {
      return res.status(400).json({ success: false, error: 'A slot is already booked for this application' });
    }

    // Must be in an active status, NOT waitlisted
    if (admission.status === 'waitlisted') {
      return res.status(400).json({ success: false, error: 'Waitlisted applications cannot book slots yet' });
    }

    // 2. Security: Verify mobile via session (mocked in dev)
    const { isMobileVerified } = require('../services');
    const isVerified = await isMobileVerified(admission.mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ success: false, error: 'Mobile not verified' });
    }

    // 3. Find and Verify Slot
    const slot = await CounsellingSlot.findById(slotId);
    if (!slot || slot.status !== 'available' || slot.bookedCount >= slot.capacity) {
      return res.status(400).json({ success: false, error: 'Selected slot is no longer available' });
    }

    // 4. Update Slot Count and Create Booking
    slot.bookedCount += 1;
    if (slot.bookedCount >= slot.capacity) slot.status = 'full';
    await slot.save();

    const booking = await SlotBooking.create({
      slotId: slot._id,
      admissionId: admission._id,
      tokenId: admission.tokenId,
      parentEmail: admission.email
    });

    admission.slotBookingId = booking._id as any;
    await admission.save();

    // Send notifications (WhatsApp + Email + Calendar Invites)
    const slotDateFormatted = slot.date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    // Send WhatsApp confirmation
    sendSlotConfirmationWhatsApp({
      to: admission.mobile,
      tokenId: admission.tokenId,
      studentName: admission.studentName,
      slotDate: slotDateFormatted,
      slotTime: `${slot.startTime} - ${slot.endTime}`,
      location: DEFAULT_LOCATION
    }).catch((err) => console.error('WhatsApp notification error:', err));

    // Send parent calendar invite
    sendParentCalendarInvite({
      parentEmail: admission.email,
      parentName: admission.parentName,
      studentName: admission.studentName,
      tokenId: admission.tokenId,
      slotDate: slot.date,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      location: DEFAULT_LOCATION
    }).catch((err) => console.error('Parent calendar invite error:', err));

    // Send principal calendar invite
    sendPrincipalCalendarInvite({
      studentName: admission.studentName,
      parentName: admission.parentName,
      tokenId: admission.tokenId,
      slotDate: slot.date,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      location: DEFAULT_LOCATION
    }).catch((err) => console.error('Principal calendar invite error:', err));

    res.json({ success: true, message: 'Slot booked successfully!' });
  } catch (error) {
    console.error('Parent self-booking error:', error);
    res.status(500).json({ success: false, error: 'Failed to book slot' });
  }
});

/**
 * PUT /api/slots/:id
 * Update slot (admin only)
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, capacity } = req.body;

    if (status && !['available', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Use "available" or "disabled"'
      });
    }

    if (capacity !== undefined && (typeof capacity !== 'number' || capacity < 1)) {
      return res.status(400).json({
        success: false,
        error: 'Capacity must be a positive number'
      });
    }

    const slot = await CounsellingSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    // Don't allow disabling if slot has bookings
    if (status === 'disabled' && slot.bookedCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot disable a slot with existing bookings'
      });
    }

    // Don't allow enabling if slot is full
    if (status === 'available' && slot.bookedCount >= slot.capacity) {
      return res.status(400).json({
        success: false,
        error: 'Cannot enable slot - it is fully booked'
      });
    }

    if (capacity !== undefined) {
      if (capacity < slot.bookedCount) {
        return res.status(400).json({
          success: false,
          error: `Cannot reduce capacity below current booked count (${slot.bookedCount})`
        });
      }
      slot.capacity = capacity;
    }

    if (status) {
      slot.status = status;
    }

    await slot.save();

    res.json({
      success: true,
      data: slot
    });
  } catch (error) {
    console.error('Update slot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update slot'
    });
  }
});

/**
 * POST /api/slots/:id/book
 * Book a slot for an admission (admin only)
 */
router.post('/:id/book', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { admissionId } = req.body;

    if (!admissionId) {
      return res.status(400).json({
        success: false,
        error: 'Admission ID is required'
      });
    }

    // Find the slot
    const slot = await CounsellingSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    // Check slot availability
    if (slot.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Slot is not available'
      });
    }

    if (slot.bookedCount >= slot.capacity) {
      return res.status(400).json({
        success: false,
        error: 'Slot is fully booked'
      });
    }

    // Check if slot is in the past (using IST)
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    const todayIST = new Date(istNow);
    todayIST.setHours(0, 0, 0, 0);

    const slotDate = new Date(slot.date);
    slotDate.setHours(0, 0, 0, 0);

    const currentTimeStr = `${String(istNow.getHours()).padStart(2, '0')}:${String(istNow.getMinutes()).padStart(2, '0')}`;

    if (slotDate < todayIST || (slotDate.getTime() === todayIST.getTime() && slot.startTime <= currentTimeStr)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book a slot that has already passed'
      });
    }

    // Find the admission
    const admission = await Admission.findById(admissionId);
    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    // Check if admission is in an allowed status for booking
    if (!['submitted', 'approved', 'confirmed', 'waitlisted', 'draft'].includes(admission.status)) {
      return res.status(400).json({
        success: false,
        error: `Counselling slots can only be booked for submitted, approved, confirmed, waitlisted, or draft admission forms. Current status: ${admission.status}`
      });
    }

    // Check if admission already has a booking and handle as reschedule
    const existingBooking = await SlotBooking.findOne({ admissionId });
    let booking;
    let isReschedule = false;

    if (existingBooking) {
      // If same slot, just return
      if (existingBooking.slotId.toString() === slot._id.toString()) {
        return res.json({
          success: true,
          data: {
            booking: existingBooking,
            slot,
            message: 'Admission already booked for this slot'
          }
        });
      }

      // Handle Reschedule: Decrement count on old slot
      const oldSlot = await CounsellingSlot.findById(existingBooking.slotId);
      if (oldSlot) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        if (oldSlot.bookedCount < oldSlot.capacity && oldSlot.status === 'full') {
          oldSlot.status = 'available';
        }
        await oldSlot.save();
      }

      // Update existing booking
      existingBooking.slotId = slot._id as any;
      existingBooking.calendarInviteSent = false;
      existingBooking.principalInviteSent = false;
      existingBooking.bookedAt = new Date();
      await existingBooking.save();
      booking = existingBooking;
      isReschedule = true;
    } else {
      // Create new booking
      booking = await SlotBooking.create({
        slotId: slot._id,
        admissionId: admission._id,
        tokenId: admission.tokenId,
        parentEmail: admission.email,
        calendarInviteSent: false,
        principalInviteSent: false
      });
    }

    // Update slot count
    slot.bookedCount += 1;
    if (slot.bookedCount >= slot.capacity) {
      slot.status = 'full';
    }
    await slot.save();

    // Update admission with booking reference
    admission.slotBookingId = booking._id as any;
    await admission.save();

    // Send notifications (in background, don't block response)
    const slotDateFormatted = slot.date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    // Use a collector for mock notifications in dev mode
    const mockNotifications: any[] = [];

    // Send WhatsApp
    const whatsappPromise = isReschedule
      ? sendSlotRescheduleWhatsApp({
        to: admission.mobile,
        tokenId: admission.tokenId,
        studentName: admission.studentName,
        slotDate: slotDateFormatted,
        slotTime: `${slot.startTime} - ${slot.endTime}`
      }).then(async (result) => {
        if ((process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') && result.mockMessage) {
          mockNotifications.push({ type: 'whatsapp', to: result.to, content: result.mockMessage });
        }
      }).catch((err) => {
        console.error('WhatsApp notification error:', err);
      })
      : sendSlotConfirmationWhatsApp({
        to: admission.mobile,
        tokenId: admission.tokenId,
        studentName: admission.studentName,
        slotDate: slotDateFormatted,
        slotTime: `${slot.startTime} - ${slot.endTime}`,
        location: DEFAULT_LOCATION
      }).then(async (result) => {
        if ((process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') && result.mockMessage) {
          mockNotifications.push({ type: 'whatsapp', to: result.to, content: result.mockMessage });
        }
        // Update whatsappSent flag on the associated enquiry
        if (admission.enquiryId) {
          await Enquiry.findByIdAndUpdate(admission.enquiryId, { whatsappSent: true });
        }
      }).catch((err) => {
        console.error('WhatsApp notification error:', err);
      });

    // Send parent calendar invite
    const parentInvitePromise = sendParentCalendarInvite({
      parentEmail: admission.email,
      parentName: admission.parentName,
      studentName: admission.studentName,
      tokenId: admission.tokenId,
      slotDate: slot.date,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      location: DEFAULT_LOCATION,
      isReschedule
    }).then(async (result) => {
      if (result.success) {
        await SlotBooking.findByIdAndUpdate(booking._id, { calendarInviteSent: true });
        if ((process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') && result.mockMessage) {
          mockNotifications.push({ type: 'email-parent', to: result.to, content: result.mockMessage });
        }
      }
    }).catch((err) => {
      console.error('Parent calendar invite error:', err);
    });

    // Send principal calendar invite
    const principalInvitePromise = sendPrincipalCalendarInvite({
      studentName: admission.studentName,
      parentName: admission.parentName,
      tokenId: admission.tokenId,
      slotDate: slot.date,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      location: DEFAULT_LOCATION,
      isReschedule
    }).then(async (result) => {
      if (result.success) {
        await SlotBooking.findByIdAndUpdate(booking._id, { principalInviteSent: true });
        if ((process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') && result.mockMessage) {
          mockNotifications.push({ type: 'email-principal', to: result.to, content: result.mockMessage });
        }
      }
    }).catch((err) => {
      console.error('Principal calendar invite error:', err);
    });

    // In development, wait for notifications to finish so we can return them
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
      await Promise.all([whatsappPromise, parentInvitePromise, principalInvitePromise]);
    }

    res.status(201).json({
      success: true,
      data: {
        booking,
        slot,
        mockNotifications: mockNotifications.length > 0 ? mockNotifications : undefined,
        message: isReschedule
          ? 'Slot rescheduled successfully.'
          : 'Slot booked successfully.'
      }
    });
  } catch (error) {
    console.error('Book slot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to book slot'
    });
  }
});

/**
 * DELETE /api/slots/:slotId/bookings/:bookingId
 * Cancel a booking (admin only)
 */
router.delete('/:slotId/bookings/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { slotId, bookingId } = req.params;

    const booking = await SlotBooking.findById(bookingId);
    if (!booking || booking.slotId.toString() !== slotId) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const slot = await CounsellingSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    // Check if slot is in the past
    const todayStr = new Date().toISOString().split('T')[0];
    const slotDateStr = slot.date.toISOString().split('T')[0];

    const [hours, minutes] = slot.endTime.split(':').map(Number);
    const slotEndTime = new Date(slot.date);
    slotEndTime.setHours(hours, minutes, 0, 0);

    if (slotEndTime < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a booking for a past slot'
      });
    }
    // Decrement slot count
    slot.bookedCount = Math.max(0, slot.bookedCount - 1);
    if (slot.bookedCount < slot.capacity && slot.status === 'full') {
      slot.status = 'available';
    }
    await slot.save();

    // Remove booking reference from admission
    await Admission.findByIdAndUpdate(booking.admissionId, {
      $unset: { slotBookingId: 1 }
    });

    // Delete booking
    await SlotBooking.findByIdAndDelete(bookingId);

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

/**
 * GET /api/slots/:id
 * Get a single slot by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const slot = await CounsellingSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Slot not found' });
    }
    const bookings = await SlotBooking.find({ slotId: slot._id });
    const totalBookings = bookings.length;

    if (slot.bookedCount !== totalBookings) {
      slot.bookedCount = totalBookings;
      await slot.save();
    }

    res.json({
      success: true,
      data: {
        ...slot.toObject(),
        bookedCount: totalBookings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch slot' });
  }
});

/**
 * GET /api/slots/:id/bookings
 * Fetch all bookings for a specific slot
 */
router.get('/:id/bookings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await SlotBooking.find({ slotId: req.params.id })
      .populate({
        path: 'admissionId',
        select: 'studentName parentName noShowCount status'
      });
    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Fetch slot bookings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

/**
 * DELETE /api/slots/:id
 * Delete a slot (admin only)
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const slot = await CounsellingSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    // Don't allow deleting if slot has bookings
    if (slot.bookedCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a slot with existing bookings. Please cancel bookings first.'
      });
    }

    await CounsellingSlot.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Slot deleted successfully'
    });
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete slot'
    });
  }
});

/**
 * POST /api/slots/bookings/:bookingId/no-show
 * Requirement 2.4: Handle parent no-show
 */
router.post('/bookings/:bookingId/no-show', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;
    const booking = await SlotBooking.findById(bookingId).populate('slotId');
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const currentSlot = booking.slotId as any;
    if (!currentSlot) return res.status(404).json({ success: false, error: 'Slot not found' });

    // ENFORCE: No-show should ONLY be marked during the time slot
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentTimeStr = `${String(istNow.getHours()).padStart(2, '0')}:${String(istNow.getMinutes()).padStart(2, '0')}`;

    const slotDate = new Date(currentSlot.date);
    const todayIST = new Date(istNow);
    todayIST.setHours(0, 0, 0, 0);
    slotDate.setHours(0, 0, 0, 0);

    const isSameDay = slotDate.getTime() === todayIST.getTime();
    const isDuringSlot = isSameDay && currentTimeStr >= currentSlot.startTime && currentTimeStr <= currentSlot.endTime;

    if (!isDuringSlot) {
      return res.status(400).json({
        success: false,
        error: 'No-show can only be marked during the actual time slot'
      });
    }

    const parentEmail = booking.parentEmail;
    const parentBookings = await SlotBooking.find({ parentEmail });

    // Find all linked admissions
    const admissions = await Admission.find({
      $or: [
        { _id: { $in: parentBookings.map(pb => pb.admissionId) } },
        { email: parentEmail }
      ]
    });

    const firstAdmission = admissions[0];
    if (!firstAdmission) return res.status(404).json({ success: false, error: 'Admissions not found' });

    if (firstAdmission.noShowCount === 0) {
      // FIRST NO-SHOW: Move ALL applications to next available slot
      const nextSlot = await CounsellingSlot.findOne({
        status: 'available',
        $or: [
          { date: { $gt: currentSlot.date } },
          { date: currentSlot.date, startTime: { $gt: currentSlot.startTime } }
        ]
      }).sort({ date: 1, startTime: 1 });

      if (!nextSlot) {
        return res.status(400).json({ success: false, error: 'No future available slots found' });
      }

      // Requirement 2.4: Increase target slot capacity to accommodate these admissions
      nextSlot.capacity += admissions.length;
      nextSlot.bookedCount += admissions.length;
      if (nextSlot.bookedCount >= nextSlot.capacity) {
        nextSlot.status = 'full';
      }
      await nextSlot.save();

      // Decrement old slot count for each parent booking
      for (const pb of parentBookings) {
        const oldSlot = await CounsellingSlot.findById(pb.slotId);
        if (oldSlot) {
          oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
          if (oldSlot.bookedCount < oldSlot.capacity && oldSlot.status === 'full') {
            oldSlot.status = 'available';
          }
          await oldSlot.save();
        }
      }

      // Update all admissions and bookings
      for (const adm of admissions) {
        adm.noShowCount = 1;
        await adm.save();
      }
      for (const pb of parentBookings) {
        pb.slotId = nextSlot._id as any;
        pb.bookedAt = new Date();
        await pb.save();
      }

      // SEND NOTIFICATIONS (WhatsApp + Email + Calendar Invites)
      try {
        const { sendNoShowRescheduleWhatsApp } = require('../services/whatsapp');
        const formattedDate = nextSlot.date.toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata'
        });

        // Send WhatsApp notification
        await sendNoShowRescheduleWhatsApp({
          to: firstAdmission.mobile,
          tokenId: firstAdmission.tokenId,
          studentName: firstAdmission.studentName,
          slotDate: formattedDate,
          slotTime: `${nextSlot.startTime} - ${nextSlot.endTime}`
        });

        // Send parent calendar invite email
        await sendParentCalendarInvite({
          parentEmail: firstAdmission.email,
          parentName: firstAdmission.parentName,
          studentName: firstAdmission.studentName,
          tokenId: firstAdmission.tokenId,
          slotDate: nextSlot.date,
          slotStartTime: nextSlot.startTime,
          slotEndTime: nextSlot.endTime,
          location: DEFAULT_LOCATION,
          isReschedule: true
        });

        // Send principal calendar invite
        await sendPrincipalCalendarInvite({
          studentName: firstAdmission.studentName,
          parentName: firstAdmission.parentName,
          tokenId: firstAdmission.tokenId,
          slotDate: nextSlot.date,
          slotStartTime: nextSlot.startTime,
          slotEndTime: nextSlot.endTime,
          location: DEFAULT_LOCATION,
          isReschedule: true
        });
      } catch (err) {
        console.error('No-show notification failed', err);
      }

      res.json({ success: true, message: `First no-show handled. All ${admissions.length} applications moved to next available slot.` });
    } else {
      // SECOND NO-SHOW: Move ALL to Waitlist
      for (const adm of admissions) {
        adm.noShowCount = 2;
        adm.status = 'waitlisted';
        adm.waitlistDate = new Date();
        adm.notes = (adm.notes || '') + '\nAutomatically moved to waitlist after second counselling no-show.';
        adm.slotBookingId = undefined;
        await adm.save();
      }

      // Decrement old slot count for each parent booking
      for (const pb of parentBookings) {
        const oldSlot = await CounsellingSlot.findById(pb.slotId);
        if (oldSlot) {
          oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
          if (oldSlot.bookedCount < oldSlot.capacity && oldSlot.status === 'full') {
            oldSlot.status = 'available';
          }
          await oldSlot.save();
        }
      }

      // Remove all bookings
      await SlotBooking.deleteMany({ parentEmail });

      // SEND NOTIFICATION
      try {
        const { sendWaitlistEmail } = require('../services/email');
        const { sendStatusUpdateWhatsApp } = require('../services/whatsapp');

        // Send WhatsApp
        await sendStatusUpdateWhatsApp({
          to: firstAdmission.mobile,
          tokenId: firstAdmission.tokenId,
          studentName: firstAdmission.studentName,
          status: 'waitlisted'
        });

        // Send Waitlist Email
        await sendWaitlistEmail({
          parentEmail: firstAdmission.email,
          parentName: firstAdmission.parentName,
          studentName: firstAdmission.studentName,
          tokenId: firstAdmission.tokenId,
          grade: firstAdmission.grade
        });

      } catch (err) {
        console.error('No-show waitlist notification failed', err);
      }

      res.json({ success: true, message: `Second no-show handled. All ${admissions.length} applications moved to waitlist.` });
    }
  } catch (error) {
    console.error('No-show handler error:', error);
    res.status(500).json({ success: false, error: 'Failed to handle no-show' });
  }
});

/**
 * POST /api/slots/:id/cancel
 * Requirement 2.5: School-initiated cancellation
 */
router.post('/:id/cancel', authenticate, async (req, res: Response) => {
  try {
    const slotId = req.params.id;
    const slot = await CounsellingSlot.findById(slotId);
    if (!slot) return res.status(404).json({ success: false, error: 'Slot not found' });

    // Find all bookings for this slot
    const bookings = await SlotBooking.find({ slotId });

    // Requirement 2.5: All affected parents move to the SAME next immediately available slot
    const nextSlot = await CounsellingSlot.findOne({
      _id: { $ne: slotId },
      status: 'available',
      $or: [
        { date: { $gt: slot.date } },
        { date: slot.date, startTime: { $gt: slot.startTime } }
      ]
    }).sort({ date: 1, startTime: 1 });

    let rescheduledCount = 0;

    if (nextSlot) {
      // Group bookings by parent to follow "+1 logic per affected parent"
      const bookingsByParent = bookings.reduce((acc, b) => {
        if (!acc[b.parentEmail]) acc[b.parentEmail] = [];
        acc[b.parentEmail].push(b);
        return acc;
      }, {} as Record<string, typeof bookings>);

      const totalMoved = bookings.length;
      const newBookedCount = nextSlot.bookedCount + totalMoved;

      // Only increase capacity if we exceed the current limit
      if (newBookedCount > nextSlot.capacity) {
        nextSlot.capacity = newBookedCount;
      }

      nextSlot.bookedCount = newBookedCount;

      // If we've reached or exceeded capacity (due to rescheduling), mark as full
      if (nextSlot.bookedCount >= nextSlot.capacity) {
        nextSlot.status = 'full';
      }

      await nextSlot.save();

      const uniqueParents = Object.keys(bookingsByParent);

      for (const parentEmail of uniqueParents) {
        const parentBookings = bookingsByParent[parentEmail];
        const firstBooking = parentBookings[0];

        // Move all filings for this parent
        for (const b of parentBookings) {
          b.slotId = nextSlot._id as any;
          b.bookedAt = new Date();
          await b.save();
          rescheduledCount++;
        }

        // SEND NOTIFICATIONS to each parent (WhatsApp + Email + Calendar Invites)
        try {
          const admission = await Admission.findById(firstBooking.admissionId);
          if (admission) {
            const formattedDate = nextSlot.date.toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata'
            });

            // Send WhatsApp notification
            await sendSlotRescheduleWhatsApp({
              to: admission.mobile,
              tokenId: admission.tokenId,
              studentName: admission.studentName,
              slotDate: formattedDate,
              slotTime: `${nextSlot.startTime} - ${nextSlot.endTime}`,
              reason: 'School administration has rescheduled your appointment.'
            }).catch((e: any) => console.error('Failed to send reschedule WhatsApp:', e));

            // Send parent calendar invite email
            await sendParentCalendarInvite({
              parentEmail: admission.email,
              parentName: admission.parentName,
              studentName: admission.studentName,
              tokenId: admission.tokenId,
              slotDate: nextSlot.date,
              slotStartTime: nextSlot.startTime,
              slotEndTime: nextSlot.endTime,
              location: DEFAULT_LOCATION,
              isReschedule: true
            }).catch((e: any) => console.error('Failed to send parent calendar invite:', e));

            // Send principal calendar invite
            await sendPrincipalCalendarInvite({
              studentName: admission.studentName,
              parentName: admission.parentName,
              tokenId: admission.tokenId,
              slotDate: nextSlot.date,
              slotStartTime: nextSlot.startTime,
              slotEndTime: nextSlot.endTime,
              location: DEFAULT_LOCATION,
              isReschedule: true
            }).catch((e: any) => console.error('Failed to send principal calendar invite:', e));
          }
        } catch (err) {
          console.error('Notification error during slot cancellation:', err);
        }
      }
    }

    // Set current slot as disabled/cancelled
    slot.status = 'disabled';
    slot.bookedCount = 0; // All moved
    await slot.save();

    res.json({ success: true, message: `Slot cancelled. ${rescheduledCount} parents rescheduled.` });
  } catch (error) {
    console.error('Slot cancellation error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel slot' });
  }
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default router;
