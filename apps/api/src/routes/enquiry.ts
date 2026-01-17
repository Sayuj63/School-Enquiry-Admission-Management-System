import { Router, Response } from 'express';
import { Enquiry, Admission } from '../models';
import { generateTokenId } from '@sayuj/shared';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose';
import { sendEnquiryWhatsApp, isMobileVerified } from '../services';

const router: Router = Router();

/**
 * POST /api/enquiry
 * Submit new enquiry (public endpoint for external frontend)
 */
router.post('/', async (req, res: Response) => {
  try {
    // Support both snake_case (external) and camelCase (internal) formats
    const data = {
      parentName: req.body.parentName || req.body.parent_name,
      childName: req.body.childName || req.body.child_name,
      mobile: req.body.mobile,
      email: req.body.email,
      city: req.body.city || '',
      grade: req.body.grade,
      message: req.body.message || ''
    };

    // Validate required fields
    if (!data.parentName || !data.childName || !data.mobile || !data.email || !data.grade) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: parentName, childName, mobile, email, grade'
      });
    }

    // Check if mobile is verified (skip in development for testing)
    const isVerified = await isMobileVerified(data.mobile);
    const mobileVerified = process.env.NODE_ENV === 'development' ? true : isVerified;

    // Generate unique token ID
    const tokenId = generateTokenId();

    // Extract additional fields
    const standardKeys = ['parentName', 'parent_name', 'childName', 'child_name', 'mobile', 'email', 'city', 'grade', 'message'];
    const additionalFields: Record<string, any> = {};

    Object.keys(req.body).forEach(key => {
      if (!standardKeys.includes(key)) {
        additionalFields[key] = req.body[key];
      }
    });

    // Create enquiry
    const enquiry = await Enquiry.create({
      ...data,
      additionalFields,
      tokenId,
      mobileVerified,
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
        tokenId: enquiry.tokenId,
        message: 'Enquiry submitted successfully',
        mockNotification
      }
    });
  } catch (error) {
    console.error('Create enquiry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit enquiry'
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

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalEnquiries, enquiriesToday, enquiriesThisMonth, pendingAdmissions, recentEnquiries] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ createdAt: { $gte: today } }),
      Enquiry.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Admission.countDocuments({ status: 'draft' }),
      Enquiry.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('tokenId childName grade createdAt')
    ]);

    res.json({
      success: true,
      data: {
        totalEnquiries,
        enquiriesToday,
        enquiriesThisMonth,
        pendingAdmissions,
        recentEnquiries
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
