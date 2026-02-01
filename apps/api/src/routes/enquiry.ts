import { Router, Response } from 'express';
import { Enquiry, Admission, CounsellingSlot, SlotBooking } from '../models';
import { generateTokenId } from '../utils/token';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose';
import { sendEnquiryWhatsApp, sendSlotConfirmationWhatsApp, isMobileVerified, sendParentCalendarInvite, sendPrincipalCalendarInvite, sendWaitlistEmail } from '../services';

const router: Router = Router();

/**
 * GET /api/enquiry/draft/:id
 * Fetch a draft enquiry for resuming (verified by OTP)
 */
router.get('/draft/:id', async (req, res: Response) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, error: 'Enquiry not found' });
    }

    // Security: check if mobile is recently verified
    const isVerified = await isMobileVerified(enquiry.mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    res.json({ success: true, data: enquiry });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch draft' });
  }
});

/**
 * GET /api/enquiry/lookup/:mobile
 * Check if a mobile number has existing enquiries (public but verified by recent OTP)
 */
router.get('/lookup/:mobile', async (req, res: Response) => {
  try {
    const { mobile } = req.params;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number is required'
      });
    }

    // Check if mobile is verified
    const isVerified = await isMobileVerified(mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({
        success: false,
        error: 'Mobile number not verified'
      });
    }

    const enquiries = await Enquiry.find({ mobile })
      .sort({ createdAt: -1 })
      .select('_id tokenId childName grade status createdAt');

    res.json({
      success: true,
      data: {
        enquiries,
        count: enquiries.length
      }
    });
  } catch (error) {
    console.error('Lookup enquiry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to lookup enquiries'
    });
  }
});

/**
 * POST /api/enquiry
 * Submit new enquiry (public endpoint for external frontend)
 */
router.post('/', async (req, res: Response) => {
  try {
    const isDraft = req.body.status === 'draft';

    // Support both snake_case (external) and camelCase (internal) formats
    const data: any = {
      parentName: req.body.parentName || req.body.parent_name,
      childName: req.body.childName || req.body.child_name,
      mobile: req.body.mobile,
      email: req.body.email,
      city: req.body.city || '',
      grade: req.body.grade,
      dob: req.body.dob,
      message: req.body.message || '',
      status: isDraft ? 'draft' : 'new'
    };

    if (!data.mobile) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }

    // Check if mobile is verified
    const isVerified = await isMobileVerified(data.mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ success: false, error: 'Mobile number not verified' });
    }

    // If it's a final submission, validate required fields
    if (!isDraft) {
      if (!data.parentName || !data.childName || !data.email || !data.grade) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields for submission'
        });
      }

      // Slot selection is no longer checked here, it's checked below after determining waitlist status
    }

    // Extract additional fields
    const standardKeys = [
      'parentName', 'parent_name', 'childName', 'child_name', 'mobile', 'email', 'city', 'grade', 'message', 'status', 'dob', 'slotId',
      '_id', 'mobileVerified', 'whatsappSent', 'createdAt', 'updatedAt', '__v', 'waitlist', 'tokenId', 'status', 'slotBookingId'
    ];
    const additionalFields: Record<string, any> = {};

    Object.keys(req.body).forEach(key => {
      if (!standardKeys.includes(key)) {
        additionalFields[key] = req.body[key];
      }
    });

    // Check for duplicate submitted enquiries (Requirement: Prevent double entry)
    const existingEnquiry = await Enquiry.findOne({
      mobile: data.mobile,
      childName: { $regex: new RegExp(`^${data.childName}$`, 'i') }, // Case insensitive
      status: { $ne: 'draft' }
    });

    if (existingEnquiry) {
      return res.status(400).json({
        success: false,
        error: `An enquiry for "${data.childName}" has already been submitted from this mobile number.`
      });
    }

    let enquiry;
    // Check if there's an existing draft for this mobile and child (simplified)
    const existingDraft = await Enquiry.findOne({
      mobile: data.mobile,
      status: 'draft',
      childName: { $regex: new RegExp(`^${data.childName}$`, 'i') }
    });

    let slot = null;
    let isWaitlist = false;

    if (!isDraft) {
      const { GradeRule } = require('../models');
      const gradeRule = await GradeRule.findOne({ grade: data.grade });

      if (gradeRule) {
        const occupiedCount = await Admission.countDocuments({
          grade: data.grade,
          status: { $in: ['confirmed', 'approved', 'submitted', 'draft'] }
        });

        const totalSeats = gradeRule.totalSeats ?? 50;

        // Respect frontend explicit waitlist request OR backend capacity check
        if (req.body.waitlist || occupiedCount >= totalSeats) {
          isWaitlist = true;

          // If grade is full and parent DID NOT request waitlist, error out
          // (This handles the case where the grade becomes full between page load and submission)
          if (occupiedCount >= totalSeats && !req.body.waitlist) {
            return res.status(400).json({
              success: false,
              errorCode: 'GRADE_FULL',
              error: `Sorry, admissions for ${data.grade} are currently full.`
            });
          }
        }
      }

      if (!isWaitlist) {
        if (!req.body.slotId) {
          return res.status(400).json({
            success: false,
            error: 'Counselling slot selection is mandatory for submission'
          });
        }
        slot = await CounsellingSlot.findById(req.body.slotId);
        if (!slot || slot.status !== 'available' || slot.bookedCount >= slot.capacity) {
          return res.status(400).json({ success: false, error: 'Selected slot is no longer available' });
        }
      }
    }

    if (existingDraft) {
      Object.assign(existingDraft, data, { additionalFields });
      enquiry = await existingDraft.save();
    } else {
      enquiry = await Enquiry.create({
        ...data,
        additionalFields,
        mobileVerified: true
      });
    }

    // If final submission
    if (!isDraft && (slot || isWaitlist)) {
      // 1. Generate unique token ID
      enquiry.tokenId = generateTokenId();
      enquiry.status = 'new';

      let bookingId = null;
      if (slot) {
        // 2. Book the slot
        const booking = await SlotBooking.create({
          slotId: slot._id,
          enquiryId: enquiry._id,
          tokenId: enquiry.tokenId,
          parentEmail: enquiry.email
        });
        bookingId = booking._id;
        enquiry.slotBookingId = bookingId as any;

        // Update slot count
        slot.bookedCount += 1;
        if (slot.bookedCount >= slot.capacity) slot.status = 'full';
        await slot.save();
      }

      await enquiry.save();

      // 4. Automatically create Admission record
      const admission = await Admission.create({
        enquiryId: enquiry._id,
        tokenId: enquiry.tokenId,
        studentName: enquiry.childName,
        parentName: enquiry.parentName,
        mobile: enquiry.mobile,
        email: enquiry.email,
        city: enquiry.city,
        grade: enquiry.grade,
        status: isWaitlist ? 'waitlisted' : 'draft',
        waitlistType: isWaitlist ? 'parent' : undefined,
        waitlistDate: isWaitlist ? new Date() : undefined,
        documents: [],
        slotBookingId: bookingId as any,
        additionalFields: new Map()
      });

      // 5. Link Admission back to SlotBooking
      if (bookingId) {
        await SlotBooking.findByIdAndUpdate(bookingId, { admissionId: admission._id });
      }

      // 3. Send Notifications
      try {
        await sendEnquiryWhatsApp({
          to: enquiry.mobile,
          tokenId: enquiry.tokenId || '',
          studentName: enquiry.childName,
          parentName: enquiry.parentName
        });

        if (enquiry.slotBookingId && slot) {
          const slotDateFormatted = slot.date.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });

          await sendSlotConfirmationWhatsApp({
            to: enquiry.mobile,
            tokenId: enquiry.tokenId || '',
            studentName: enquiry.childName,
            slotDate: slotDateFormatted,
            slotTime: `${slot.startTime} - ${slot.endTime}`,
            location: 'School Campus'
          });

          // Send Calendar Invites
          await sendParentCalendarInvite({
            parentEmail: enquiry.email,
            parentName: enquiry.parentName,
            studentName: enquiry.childName,
            tokenId: enquiry.tokenId || '',
            slotDate: slot.date,
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
            location: 'School Campus'
          }).catch(err => console.error('Parent calendar invite error:', err));

          await sendPrincipalCalendarInvite({
            studentName: enquiry.childName,
            parentName: enquiry.parentName,
            tokenId: enquiry.tokenId || '',
            slotDate: slot.date,
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
            location: 'School Campus'
          }).catch(err => console.error('Principal calendar invite error:', err));
        }

        if (isWaitlist) {
          const { sendStatusUpdateWhatsApp } = require('../services/whatsapp');
          await sendStatusUpdateWhatsApp({
            to: enquiry.mobile,
            tokenId: enquiry.tokenId,
            studentName: enquiry.childName,
            status: 'waitlisted'
          });

          // Send Email Notification for Waitlist
          if (enquiry.email) {
            await sendWaitlistEmail({
              parentEmail: enquiry.email,
              parentName: enquiry.parentName,
              studentName: enquiry.childName,
              tokenId: enquiry.tokenId || '',
              grade: enquiry.grade
            });
          }
        }
        await Enquiry.findByIdAndUpdate(enquiry._id, { whatsappSent: true });
      } catch (err) {
        console.error('Notification failed', err);
      }
    }

    res.status(isDraft ? 200 : 201).json({
      success: true,
      data: {
        tokenId: enquiry.tokenId,
        message: isDraft ? 'Draft saved successfully' : 'Enquiry submitted successfully'
      }
    });
  } catch (error: any) {
    console.error('Enquiry processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process enquiry'
    });
  }
});

/**
 * GET /api/enquiry/token/:tokenId
 * Get single enquiry details by Token ID (public but verified by recent OTP)
 */
router.get('/token/:tokenId', async (req, res: Response) => {
  try {
    const { tokenId } = req.params;

    const enquiry = await Enquiry.findOne({ tokenId });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    // Security check: must match a verified mobile in recent session
    // In a real app, we'd check session/JWT. For now, check if the enquiry's mobile is verified.
    const isVerified = await isMobileVerified(enquiry.mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized access to this enquiry'
      });
    }

    // Check if admission exists for this enquiry to show slot info
    const admission = await Admission.findOne({ enquiryId: enquiry._id })
      .populate('slotBookingId');

    let slotInfo = null;
    if (admission && (admission as any).slotBookingId) {
      const slotBooking = (admission as any).slotBookingId;
      const slot = await CounsellingSlot.findById(slotBooking.slotId);
      if (slot) {
        slotInfo = {
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          location: 'School Campus, Counselling Room 101' // Default or dynamic
        };
      }
    }

    res.json({
      success: true,
      data: {
        enquiry,
        admission: admission ? {
          status: admission.status,
          documents: admission.documents
        } : null,
        slot: slotInfo
      }
    });
  } catch (error) {
    console.error('Get enquiry by token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enquiry details'
    });
  }
});

/**
 * POST /api/enquiry/admin
 * Manual enquiry entry by admin (requires auth, bypasses OTP)
 */
router.post('/admin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = {
      parentName: req.body.parentName,
      childName: req.body.childName,
      mobile: req.body.mobile,
      email: req.body.email,
      grade: req.body.grade,
      city: req.body.city || '',
      message: req.body.message || ''
    };

    if (!data.parentName || !data.childName || !data.mobile || !data.grade) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Check for duplicate submitted enquiries
    const existingEnquiry = await Enquiry.findOne({
      mobile: data.mobile,
      childName: { $regex: new RegExp(`^${data.childName}$`, 'i') },
      status: { $ne: 'draft' }
    });

    if (existingEnquiry) {
      return res.status(400).json({
        success: false,
        error: `An enquiry for "${data.childName}" has already been submitted from this mobile number.`
      });
    }

    // Seat availability check (3.6.2)
    const { GradeRule } = require('../models');
    const gradeRule = await GradeRule.findOne({ grade: data.grade });
    if (gradeRule) {
      const confirmedCount = await Admission.countDocuments({
        grade: data.grade,
        status: { $in: ['confirmed', 'approved'] }
      });
      if (confirmedCount >= gradeRule.totalSeats) {
        return res.status(400).json({
          success: false,
          error: `Admissions for ${data.grade} are currently full.`
        });
      }
    }

    // Check if mobile is verified
    const isVerified = await isMobileVerified(data.mobile);
    const mobileVerified = process.env.NODE_ENV === 'development' ? true : isVerified;

    if (!mobileVerified) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number not verified'
      });
    }

    const tokenId = generateTokenId();
    const standardKeys = ['parentName', 'childName', 'mobile', 'email', 'city', 'grade', 'message'];
    const additionalFields: Record<string, any> = {};

    Object.keys(req.body).forEach(key => {
      if (!standardKeys.includes(key)) {
        additionalFields[key] = req.body[key];
      }
    });

    const enquiry = await Enquiry.create({
      ...data,
      additionalFields,
      tokenId,
      mobileVerified: true,
      status: 'new'
    });

    let mockNotification;
    try {
      const whatsappResult = await sendEnquiryWhatsApp({
        to: data.mobile,
        tokenId,
        studentName: data.childName,
        parentName: data.parentName
      });

      enquiry.whatsappSent = whatsappResult.success;
      await enquiry.save();

      if ((process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') && whatsappResult.mockMessage) {
        mockNotification = {
          type: 'whatsapp',
          to: whatsappResult.to,
          content: whatsappResult.mockMessage
        };
      }
    } catch (whatsappError) {
      console.error('WhatsApp notification failed:', whatsappError);
    }

    res.status(201).json({
      success: true,
      data: {
        ...enquiry.toObject(),
        mockNotification
      }
    });
  } catch (error) {
    console.error('Admin enquiry creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create enquiry'
    });
  }
});

/**
 * GET /api/enquiries
 * List all enquiries (admin only)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const grade = req.query.grade as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const query: any = {};

    if (status && status !== 'all') {
      if (status === 'half_filled' || status === 'pending_admission') {
        query.status = 'in_progress';
        // Note: For precise filtering between half_filled and pending_admission, 
        // we would need to join with Admissions, but for now we map to the base status.
      } else {
        query.status = status;
      }
    } else if (status !== 'all') {
      // By default (or if status is undefined/empty), only show "New" enquiries.
      // Once an enquiry is converted or in progress, it moves to the Admissions section.
      query.status = 'new';
    }

    if (grade) {
      query.grade = grade;
    }

    if (search) {
      query.$or = [
        { tokenId: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } },
        { childName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    const total = await Enquiry.countDocuments(query);
    const enquiries = await Enquiry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Enrich enquiries with slot booking status and admission status
    const enrichedEnquiries = await Promise.all(
      enquiries.map(async (enquiry) => {
        const admission = await Admission.findOne({ enquiryId: enquiry._id });
        const slotBooked = admission ? !!admission.slotBookingId : false;
        const admissionStatus = admission ? admission.status : null;

        return {
          ...enquiry.toObject(),
          slotBooked,
          admissionStatus
        };
      })
    );

    res.json({
      success: true,
      data: {
        enquiries: enrichedEnquiries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List enquiries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enquiries'
    });
  }
});

/**
 * GET /api/enquiry/:id
 * Get single enquiry details (admin only)
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enquiry ID format'
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    // Check if admission exists for this enquiry
    const admission = await Admission.findOne({ enquiryId: enquiry._id });

    res.json({
      success: true,
      data: {
        enquiry,
        hasAdmission: !!admission,
        admissionId: admission?._id
      }
    });
  } catch (error) {
    console.error('Get enquiry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enquiry'
    });
  }
});

/**
 * POST /api/enquiry/:id/notify
 * Resend notifications for an enquiry
 */
router.post('/:id/notify', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, error: 'Enquiry not found' });
    }

    if (enquiry.status === 'draft') {
      return res.status(400).json({ success: false, error: 'Cannot send notifications for draft enquiries' });
    }

    // Send Enquiry WhatsApp
    await sendEnquiryWhatsApp({
      to: enquiry.mobile,
      tokenId: enquiry.tokenId!,
      studentName: enquiry.childName,
      parentName: enquiry.parentName
    });

    // If slot is booked, send slot confirmation too
    if (enquiry.slotBookingId) {
      const booking = await SlotBooking.findById(enquiry.slotBookingId).populate('slotId');
      if (booking && booking.slotId) {
        const slot = booking.slotId as any; // Cast to any or ICounsellingSlot for simplicity in this context
        const slotDateFormatted = new Date(slot.date).toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        await sendSlotConfirmationWhatsApp({
          to: enquiry.mobile,
          tokenId: enquiry.tokenId!,
          studentName: enquiry.childName,
          slotDate: slotDateFormatted,
          slotTime: `${slot.startTime} - ${slot.endTime}`,
          location: 'School Campus'
        });

        // Also resend calendar invites (Emails)
        await Promise.all([
          sendParentCalendarInvite({
            parentEmail: enquiry.email,
            parentName: enquiry.parentName,
            studentName: enquiry.childName,
            tokenId: enquiry.tokenId!,
            slotDate: new Date(slot.date),
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
            location: 'School Campus'
          }),
          sendPrincipalCalendarInvite({
            studentName: enquiry.childName,
            parentName: enquiry.parentName,
            tokenId: enquiry.tokenId!,
            slotDate: new Date(slot.date),
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
            location: 'School Campus'
          })
        ]);
      }
    }

    await Enquiry.findByIdAndUpdate(enquiry._id, { whatsappSent: true });

    res.json({ success: true, message: 'Notifications resent successfully' });
  } catch (error) {
    console.error('Resend notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend notifications' });
  }
});

/**
 * PUT /api/enquiry/:id/status
 * Update enquiry status (admin only)
 */
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enquiry ID format'
      });
    }

    const { status } = req.body;

    if (!['new', 'in_progress', 'converted'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    console.error('Update enquiry status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update enquiry status'
    });
  }
});

/**
 * GET /api/enquiries/stats
 * Get dashboard statistics (admin only)
 */
router.get('/stats/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalEnquiries,
      enquiriesToday,
      enquiriesThisMonth,
      admissionsThisMonth,
      totalAdmissions,
      waitlistedCount,
      recentEnquiries,
      todaySlots,
      recentAdmissions
    ] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ createdAt: { $gte: today } }),
      Enquiry.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Admission.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Admission.countDocuments({ status: { $in: ['approved', 'confirmed', 'submitted'] } }),
      Admission.countDocuments({ status: 'waitlisted' }),
      Enquiry.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('tokenId childName grade createdAt status'),
      CounsellingSlot.find({
        date: { $gte: today, $lt: tomorrow }
      }),
      Admission.find()
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5)
        .select('studentName status updatedAt createdAt')
    ]);

    const scheduledCounselling = todaySlots.reduce((acc, slot) => acc + (slot.bookedCount || 0), 0);

    res.json({
      success: true,
      data: {
        totalEnquiries,
        enquiriesToday,
        enquiriesThisMonth,
        admissionsThisMonth,
        totalAdmissions,
        waitlistedCount,
        scheduledCounselling,
        recentEnquiries,
        recentAdmissions
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

export default router;
