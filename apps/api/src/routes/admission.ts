import { Router, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Enquiry, Admission, SlotBooking, GradeRule } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import cloudinary from '../config/cloudinary';
import { isMobileVerified, logActivity } from '../services';

const router: Router = Router();

/**
 * POST /api/admission/create/:enquiryId
 * Create admission form from enquiry (admin only)
 */
router.post('/create/:enquiryId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const enquiryId = req.params.enquiryId.trim().split(':')[0];

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(enquiryId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enquiry ID format'
      });
    }

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
      city: enquiry.city,
      grade: enquiry.grade,
      studentDob: enquiry.dob,
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
    const id = req.params.id.trim().split(':')[0];

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      console.log(`[Admission] Invalid ID format attempt: "${req.params.id}" (trimmed: "${id}")`);
      return res.status(400).json({
        success: false,
        error: 'Invalid admission ID format'
      });
    }

    const admission = await Admission.findById(id).populate('enquiryId', 'createdAt city dob');

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
    const noSlot = req.query.noSlot === 'true';
    const counselling = req.query.counselling as string;

    const query: any = {};

    if (status) {
      query.status = status;
    }
    // Removed default status='submitted' to allow viewing 'draft' admissions in "All Admissions"


    if (counselling === 'booked') {
      query.slotBookingId = { $exists: true };
    } else if (counselling === 'interview_pending') {
      query.slotBookingId = { $exists: true };

      if (query.status) {
        // If status is already filtered, we need to ensure we don't return approved/rejected
        // ignoring the fact that if query.status is 'approved', this will result in 0 docs (correct)
        const currentStatus = query.status;
        delete query.status; // Remove pure key to use $and
        query.$and = [
          { status: currentStatus },
          { status: { $nin: ['approved', 'rejected'] } }
        ];
      } else {
        query.status = { $nin: ['approved', 'rejected'] };
      }
    } else if (counselling === 'pending' || noSlot) {
      query.$or = [
        { slotBookingId: { $exists: false } },
        { slotBookingId: null }
      ];
      // Status is already handled above or passed explicitly
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
      .populate({
        path: 'slotBookingId',
        populate: {
          path: 'slotId',
          model: 'CounsellingSlot'
        }
      })
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
    const id = req.params.id.trim().split(':')[0];

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid admission ID format'
      });
    }

    const {
      studentName,
      parentName,
      email,
      mobile,
      grade,
      city,
      studentDob,
      parentAddress,
      parentOccupation,
      emergencyContact,
      additionalFields,
      status,
      notes
    } = req.body;

    const updateData: any = {};

    if (studentName) updateData.studentName = studentName;
    if (parentName) updateData.parentName = parentName;
    if (email) updateData.email = email.toLowerCase();
    if (mobile) updateData.mobile = mobile;
    if (grade) updateData.grade = grade;
    if (city !== undefined) updateData.city = city;
    if (studentDob) updateData.studentDob = new Date(studentDob);
    if (parentAddress !== undefined) updateData.parentAddress = parentAddress;
    if (parentOccupation !== undefined) updateData.parentOccupation = parentOccupation;
    if (emergencyContact !== undefined) {
      const currentAdmission = await Admission.findById(id);
      if (currentAdmission && emergencyContact === currentAdmission.mobile) {
        return res.status(400).json({
          success: false,
          error: 'Emergency contact number cannot be the same as the primary mobile number'
        });
      }
      updateData.emergencyContact = emergencyContact;
    }
    if (notes !== undefined) updateData.notes = notes;

    const currentAdmission = await Admission.findById(id);
    if (!currentAdmission) {
      return res.status(404).json({ success: false, error: 'Admission not found' });
    }

    if (status && ['draft', 'submitted', 'approved', 'rejected', 'waitlisted', 'confirmed'].includes(status)) {
      // Logic for status transitions
      if (['approved', 'rejected', 'confirmed', 'waitlisted', 'submitted'].includes(status) && currentAdmission.status !== status) {
        // Requirement: A counselling slot must exist (but maybe not for waitlisted initially if parent does it)
        // However, if ADMIN marks as waitlisted after counselling:
        const booking = await SlotBooking.findOne({ admissionId: id }).populate('slotId');

        if (status !== 'waitlisted' || (status === 'waitlisted' && currentAdmission.noShowCount > 0)) {
          // Basic validation: confirmed/rejected usually happen after counselling
          if (!booking && !['draft', 'submitted', 'waitlisted'].includes(status)) {
            return res.status(400).json({
              success: false,
              error: 'A counselling slot must be booked before deciding admission'
            });
          }

          // New Requirement: Counselling must be COMPLETED before decision
          if (['approved', 'rejected', 'confirmed'].includes(status) && booking && (booking as any).slotId) {
            const slot = (booking as any).slotId;
            const slotDate = new Date(slot.date);
            const [h, m] = slot.startTime.split(':').map(Number);

            const slotStart = new Date(slotDate);
            slotStart.setHours(h, m, 0, 0);

            if (new Date() < slotStart) {
              return res.status(400).json({
                success: false,
                error: `Decision not allowed yet. The counselling session is scheduled for ${slotDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${slot.startTime}. Decisions can only be made once the session has started.`
              });
            }
          }
        }

        // New Requirement: Field Completion Check for Promoting/Confirming
        if (['submitted', 'confirmed', 'approved'].includes(status)) {
          const fieldsToVerify = [
            { key: 'studentDob', label: 'Date of Birth' },
            { key: 'parentAddress', label: 'Parent Address' },
            { key: 'parentOccupation', label: 'Parent Occupation' },
            { key: 'emergencyContact', label: 'Emergency Contact' }
          ];

          for (const field of fieldsToVerify) {
            const value = updateData[field.key] || currentAdmission[field.key as keyof typeof currentAdmission];
            if (!value) {
              return res.status(400).json({
                success: false,
                error: `Promotion failed: ${field.label} is required. Please fill all fields in the form first.`
              });
            }
          }
        }

        // Seat availability check (3.6.2)
        // Seat availability check (3.6.2)
        if (status === 'confirmed' || status === 'approved' || (status === 'submitted' && currentAdmission.status === 'waitlisted')) {
          const targetGrade = grade || currentAdmission.grade;
          const gradeRule = await GradeRule.findOne({ grade: targetGrade });
          if (gradeRule) {
            const occupiedCount = await Admission.countDocuments({
              grade: targetGrade,
              status: { $in: ['confirmed', 'approved', 'submitted', 'draft'] },
              _id: { $ne: currentAdmission._id }
            });
            const totalSeats = gradeRule.totalSeats ?? 50;
            if (occupiedCount >= totalSeats) {
              return res.status(400).json({
                success: false,
                error: `Cannot ${status === 'submitted' ? 'promote' : 'confirm'} admission. Seat limit for ${targetGrade} (${totalSeats}) has been reached.`
              });
            }
          }
        }
      }
      if (status === 'waitlisted' && currentAdmission.status !== 'waitlisted') {
        updateData.waitlistDate = new Date();
        updateData.waitlistType = 'school';
        updateData.waitlistRemindersSent = [];
      }
      updateData.status = status;
    }

    if (additionalFields) {
      updateData.additionalFields = new Map(Object.entries(additionalFields));
    }

    const admission = await Admission.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!admission) {
      return res.status(404).json({
        success: false,
        error: 'Admission not found'
      });
    }

    // ERP INTEGRATION MOCK
    if (status === 'confirmed' || status === 'approved') {
      console.log('========================================');
      console.log('ERP INTEGRATION (MOCK)');
      console.log(`Sending data for student: ${admission.studentName}`);
      console.log(`Payload:`, {
        studentName: admission.studentName,
        parentName: admission.parentName,
        mobile: admission.mobile,
        grade: admission.grade,
        tokenId: admission.tokenId
      });
      console.log('Response: { success: true, erp_id: "ERP_' + Math.floor(Math.random() * 10000) + '" }');
      console.log('========================================');
    }

    // NOTIFICATIONS (WHATSAPP & EMAIL)
    if (status && status !== currentAdmission.status && ['confirmed', 'approved', 'rejected', 'waitlisted'].includes(status)) {
      // WhatsApp
      const { sendStatusUpdateWhatsApp } = require('../services/whatsapp');
      await sendStatusUpdateWhatsApp({
        to: admission.mobile,
        tokenId: admission.tokenId,
        studentName: admission.studentName,
        status: status as any
      }).catch((err: any) => console.error('WhatsApp status update error:', err));

      // Email
      const { sendAdmissionStatusEmail } = require('../services/email');
      await sendAdmissionStatusEmail({
        parentEmail: admission.email,
        parentName: admission.parentName,
        studentName: admission.studentName,
        tokenId: admission.tokenId,
        status: status as any
      }).catch((err: any) => console.error('Email status update error:', err));
    }

    if (status && status !== currentAdmission.status) {
      await logActivity({
        type: 'admission',
        action: 'status_changed',
        description: `Admission for ${admission.studentName} updated to ${status.toUpperCase()}`,
        refId: admission._id,
        tokenId: admission.tokenId,
        metadata: { oldStatus: currentAdmission.status, newStatus: status }
      });
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
 * GET /api/admission/documents/:publicId
 * Redirects to Cloudinary document URL
 */
router.get('/documents/:publicId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const admission = await Admission.findOne({ 'documents.fileId': req.params.publicId });
    if (!admission) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = admission.documents.find(d => d.fileId === req.params.publicId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.redirect(doc.url);
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to access document'
    });
  }
});

/**
 * POST /api/admission/:id/documents
 * Upload document (admin only)
 */
router.post('/:id/documents', authenticate, upload.single('document'), async (req: AuthRequest, res: Response) => {
  try {
    // Validate ObjectId format
    const id = req.params.id.trim().split(':')[0];
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid admission ID format'
      });
    }

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

    if (admission.status === 'rejected' || admission.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        error: `Cannot upload documents for ${admission.status} admission`
      });
    }

    // Add document to admission (Cloudinary stores file info in req.file)
    const file = req.file as any;

    admission.documents.push({
      type: documentType,
      fileName: req.file.originalname,
      fileId: file.filename, // This is the public_id in Cloudinary storage
      url: file.path,       // This is the secure_url in Cloudinary storage
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
    // Validate ObjectId format
    const id = req.params.id.trim().split(':')[0];
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid admission ID format'
      });
    }

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

    // Delete file from Cloudinary
    try {
      await cloudinary.uploader.destroy(doc.fileId);
    } catch (err) {
      console.error('Error deleting file from Cloudinary:', err);
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

/**
 * POST /api/admission/parent/:tokenId/documents
 * Upload document by parent (verified by OTP)
 */
router.post('/parent/:tokenId/documents', upload.single('document'), async (req, res: Response) => {
  try {
    const { tokenId } = req.params;
    const { documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (!documentType) {
      return res.status(400).json({ success: false, error: 'Document type is required' });
    }

    const admission = await Admission.findOne({ tokenId });
    if (!admission) {
      return res.status(404).json({ success: false, error: 'Admission record not found' });
    }

    // Security check: verify ownership
    const isVerified = await isMobileVerified(admission.mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Requirement 1.3.3: Upload allowed until 1 day before counselling
    if (admission.slotBookingId) {
      const booking = await SlotBooking.findById(admission.slotBookingId).populate('slotId');
      if (booking && booking.slotId) {
        const slot = booking.slotId as any;
        const slotDate = new Date(slot.date);
        const [h, m] = slot.startTime.split(':').map(Number);
        slotDate.setHours(h, m, 0, 0);

        const deadline = new Date(slotDate.getTime() - (24 * 60 * 60 * 1000));
        if (new Date() > deadline) {
          return res.status(400).json({
            success: false,
            error: 'Document upload is only allowed until 24 hours before your counselling session.'
          });
        }
      }
    }

    const file = req.file as any;
    admission.documents.push({
      type: documentType,
      fileName: req.file.originalname,
      fileId: file.filename,
      url: file.path,
      uploadedAt: new Date()
    });

    await admission.save();

    await logActivity({
      type: 'admission',
      action: 'document_uploaded',
      description: `${documentType} uploaded for ${admission.studentName}`,
      refId: admission._id,
      tokenId: admission.tokenId,
      metadata: { documentType, fileName: req.file.originalname }
    });

    res.json({
      success: true,
      data: {
        document: admission.documents[admission.documents.length - 1]
      }
    });
  } catch (error) {
    console.error('Parent upload document error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
});

/**
 * DELETE /api/admission/parent/:tokenId/documents/:docId
 * Delete document by parent (verified by OTP)
 */
router.delete('/parent/:tokenId/documents/:docId', async (req, res: Response) => {
  try {
    const { tokenId, docId } = req.params;

    const admission = await Admission.findOne({ tokenId });
    if (!admission) {
      return res.status(404).json({ success: false, error: 'Admission record not found' });
    }

    // Security check
    const isVerified = await isMobileVerified(admission.mobile);
    if (!isVerified && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Requirement 1.3.3: Delete allowed until 1 day before counselling
    if (admission.slotBookingId) {
      const booking = await SlotBooking.findById(admission.slotBookingId).populate('slotId');
      if (booking && booking.slotId) {
        const slot = booking.slotId as any;
        const slotDate = new Date(slot.date);
        const [h, m] = slot.startTime.split(':').map(Number);
        slotDate.setHours(h, m, 0, 0);

        const deadline = new Date(slotDate.getTime() - (24 * 60 * 60 * 1000));
        if (new Date() > deadline) {
          return res.status(400).json({
            success: false,
            error: 'Modifying documents is only allowed until 24 hours before your counselling session.'
          });
        }
      }
    }

    const docIndex = admission.documents.findIndex(d => d._id?.toString() === docId);
    if (docIndex === -1) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = admission.documents[docIndex];
    try {
      await cloudinary.uploader.destroy(doc.fileId);
    } catch (err) {
      console.error('Cloudinary destroy error:', err);
    }

    admission.documents.splice(docIndex, 1);
    await admission.save();

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

export default router;
