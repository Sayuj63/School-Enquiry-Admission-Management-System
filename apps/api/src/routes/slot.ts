import { Router, Response } from 'express';
import { CounsellingSlot, SlotBooking, Admission } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  sendSlotConfirmationWhatsApp,
  sendParentCalendarInvite,
  sendPrincipalCalendarInvite
} from '../services';

const router: Router = Router();

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

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time'
      });
    }

    const [year, month, day] = date.split('-').map(Number)
    const slotDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

    // Check if date is in the past
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));

    if (slotDate < todayUTC) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create slots for past dates'
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

    // Check if admission is in 'submitted' status
    if (admission.status !== 'submitted' && admission.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Counselling slots can only be booked for submitted admission forms'
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

    // Update slot count (for the new slot)
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
        await SlotBooking.findByIdAndUpdate(booking._id, {
          calendarInviteSent: true
        });
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
        await SlotBooking.findByIdAndUpdate(booking._id, {
          principalInviteSent: true
        });
      }
    }).catch((err) => {
      console.error('Principal calendar invite error:', err);
    });

    res.status(201).json({
      success: true,
      data: {
        booking,
        slot,
        message: isReschedule
          ? 'Slot rescheduled successfully. New calendar invites are being sent.'
          : 'Slot booked successfully. Calendar invites are being sent.'
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

export default router;
