import { Router, Response } from 'express';
import { Enquiry, Admission } from '../models';
import { generateTokenId } from '@sayuj/shared';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEnquiryWhatsApp, isMobileVerified } from '../services';

const router = Router();

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

    // Create enquiry
    const enquiry = await Enquiry.create({
      ...data,
      tokenId,
      mobileVerified,
      status: 'new'
    });

    // Send WhatsApp notification
    try {
      const whatsappResult = await sendEnquiryWhatsApp({
        to: data.mobile,
        tokenId,
        studentName: data.childName,
        parentName: data.parentName
      });

      enquiry.whatsappSent = whatsappResult.success;
      await enquiry.save();
    } catch (whatsappError) {
      console.error('WhatsApp notification failed:', whatsappError);
    }

    res.status(201).json({
      success: true,
      data: {
        tokenId: enquiry.tokenId,
        message: 'Enquiry submitted successfully'
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

    if (status) {
      query.status = status;
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

    res.json({
      success: true,
      data: {
        enquiries,
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
