import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Enquiry, Admission, SlotBooking } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

/**
 * POST /api/admission/create/:enquiryId
 * Create admission form from enquiry (admin only)
 */
router.post('/create/:enquiryId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { enquiryId } = req.params;

    // Find the enquiry
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry not found'
      });
    }

    // Check if admission already exists
    const existingAdmission = await Admission.findOne({ enquiryId });
    if (existingAdmission) {
      return res.status(400).json({
        success: false,
        error: 'Admission form already exists for this enquiry',
        data: { admissionId: existingAdmission._id }
      });
    }

    // Create admission with pre-filled data from enquiry
    const admission = await Admission.create({
      enquiryId: enquiry._id,
      tokenId: enquiry.tokenId,
      studentName: enquiry.childName,
      parentName: enquiry.parentName,
      mobile: enquiry.mobile,
      email: enquiry.email,
      grade: enquiry.grade,
      status: 'draft',
      documents: [],
      additionalFields: new Map()
    });

    // Update enquiry status
    enquiry.status = 'in_progress';
    await enquiry.save();

    res.status(201).json({
      success: true,
      data: admission
    });
  } catch (error) {
    console.error('Create admission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admission form'
    });
  }
});

/**
 * GET /api/admission/:id
 * Get admission details (admin only)
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const admission = await Admission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    // Get slot booking if exists
    const slotBooking = admission.slotBookingId
      ? await SlotBooking.findById(admission.slotBookingId).populate('slotId')
      : null;

    res.json({
      success: true,
      data: {
        admission,
        slotBooking
      }
    });
  } catch (error) {
    console.error('Get admission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admission'
    });
  }
});

/**
 * GET /api/admissions
 * List all admissions (admin only)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { tokenId: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Admission.countDocuments(query);
    const admissions = await Admission.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: {
        admissions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List admissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admissions'
    });
  }
});

/**
 * PUT /api/admission/:id
 * Update admission (admin only)
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      studentDob,
      parentAddress,
      parentOccupation,
      emergencyContact,
      additionalFields,
      status,
      notes
    } = req.body;

    const updateData: any = {};

    if (studentDob) updateData.studentDob = new Date(studentDob);
    if (parentAddress !== undefined) updateData.parentAddress = parentAddress;
    if (parentOccupation !== undefined) updateData.parentOccupation = parentOccupation;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (notes !== undefined) updateData.notes = notes;

    if (status && ['draft', 'submitted', 'approved', 'rejected'].includes(status)) {
      updateData.status = status;
    }

    if (additionalFields) {
      updateData.additionalFields = new Map(Object.entries(additionalFields));
    }

    const admission = await Admission.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    // If admission is approved, update enquiry status
    if (status === 'approved') {
      await Enquiry.findByIdAndUpdate(admission.enquiryId, { status: 'converted' });
    }

    res.json({
      success: true,
      data: admission
    });
  } catch (error) {
    console.error('Update admission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admission'
    });
  }
});

/**
 * POST /api/admission/:id/documents
 * Upload document (admin only)
 */
router.post('/:id/documents', authenticate, upload.single('document'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { documentType } = req.body;
    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: 'Document type is required'
      });
    }

    const admission = await Admission.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    // Add document to admission
    admission.documents.push({
      type: documentType,
      fileName: req.file.originalname,
      filePath: req.file.path,
      uploadedAt: new Date()
    });

    await admission.save();

    res.json({
      success: true,
      data: {
        document: admission.documents[admission.documents.length - 1]
      }
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
});

/**
 * DELETE /api/admission/:id/documents/:docId
 * Delete document (admin only)
 */
router.delete('/:id/documents/:docId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const admission = await Admission.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    const docIndex = admission.documents.findIndex(
      (doc) => doc._id?.toString() === req.params.docId
    );

    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const doc = admission.documents[docIndex];

    // Delete file from filesystem
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    // Remove from admission
    admission.documents.splice(docIndex, 1);
    await admission.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

export default router;
