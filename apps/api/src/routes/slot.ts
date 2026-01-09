import { Router, Response } from 'express';
import { CounsellingSlot, SlotBooking, Admission } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  sendSlotConfirmationWhatsApp,
  sendParentCalendarInvite,
  sendPrincipalCalendarInvite
} from '../services';

const router = Router();

const SLOT_CAPACITY = 3;
const DEFAULT_LOCATION = 'School Campus, Counselling Room 101';

/**
 * POST /api/slots
 * Create a new counselling slot (admin only)
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, startTime, endTime } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Date, start time, and end time are required'
      });
    }

    // Parse date
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // Check for existing slot
    const existingSlot = await CounsellingSlot.findOne({
      date: slotDate,
      startTime
    });

    if (existingSlot) {
      return res.status(400).json({
        success: false,
        error: 'A slot already exists for this date and time'
      });
    }

    const slot = await CounsellingSlot.create({
      date: slotDate,
      startTime,
      endTime,
      capacity: SLOT_CAPACITY,
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
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    if (status) {
      query.status = status;
    }

    const slots = await CounsellingSlot.find(query).sort({ date: 1, startTime: 1 });

    // Get booking counts for each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        const bookings = await SlotBooking.find({ slotId: slot._id }).populate('admissionId');
        return {
          ...slot.toObject(),
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
router.get('/available', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = await CounsellingSlot.find({
      date: { $gte: today },
      status: 'available'
    }).sort({ date: 1, startTime: 1 });

    res.json({
      success: true,
      data: slots
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
 * PUT /api/slots/:id
 * Update slot (admin only)
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!['available', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Use "available" or "disabled"'
      });
    }

    const slot = await CounsellingSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    // Don't allow enabling if slot is full
    if (status === 'available' && slot.bookedCount >= slot.capacity) {
      return res.status(400).json({
        success: false,
        error: 'Cannot enable slot - it is fully booked'
      });
    }

    slot.status = status;
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

    // Find the admission
    const admission = await Admission.findById(admissionId);
    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    // Check if admission already has a booking
    const existingBooking = await SlotBooking.findOne({ admissionId });
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'This admission already has a slot booked'
      });
    }

    // Create booking
    const booking = await SlotBooking.create({
      slotId: slot._id,
      admissionId: admission._id,
      tokenId: admission.tokenId,
      parentEmail: admission.email,
      calendarInviteSent: false,
      principalInviteSent: false
    });

    // Update slot count
    slot.bookedCount += 1;
    if (slot.bookedCount >= slot.capacity) {
      slot.status = 'full';
    }
    await slot.save();

    // Update admission with booking reference
    admission.slotBookingId = booking._id;
    await admission.save();

    // Send notifications (in background, don't block response)
    const slotDateFormatted = slot.date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send WhatsApp
    sendSlotConfirmationWhatsApp({
      to: admission.mobile,
      tokenId: admission.tokenId,
      studentName: admission.studentName,
      slotDate: slotDateFormatted,
      slotTime: `${slot.startTime} - ${slot.endTime}`,
      location: DEFAULT_LOCATION
    }).then((result) => {
      console.log('WhatsApp notification result:', result);
    }).catch((err) => {
      console.error('WhatsApp notification error:', err);
    });

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
    }).then(async (result) => {
      if (result.success) {
        booking.calendarInviteSent = true;
        await booking.save();
      }
    }).catch((err) => {
      console.error('Parent calendar invite error:', err);
    });

    // Send principal calendar invite
    sendPrincipalCalendarInvite({
      studentName: admission.studentName,
      parentName: admission.parentName,
      tokenId: admission.tokenId,
      slotDate: slot.date,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      location: DEFAULT_LOCATION
    }).then(async (result) => {
      if (result.success) {
        booking.principalInviteSent = true;
        await booking.save();
      }
    }).catch((err) => {
      console.error('Principal calendar invite error:', err);
    });

    res.status(201).json({
      success: true,
      data: {
        booking,
        slot,
        message: 'Slot booked successfully. Calendar invites are being sent.'
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

    // Update slot count
    const slot = await CounsellingSlot.findById(slotId);
    if (slot) {
      slot.bookedCount = Math.max(0, slot.bookedCount - 1);
      if (slot.bookedCount < slot.capacity && slot.status === 'full') {
        slot.status = 'available';
      }
      await slot.save();
    }

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

export default router;
