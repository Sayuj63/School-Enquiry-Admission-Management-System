import { Router, Response } from 'express';
import { FormTemplate, DocumentsList } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/templates/enquiry
 * Get enquiry form template
 */
router.get('/enquiry', async (req, res: Response) => {
  try {
    const template = await FormTemplate.findOne({ type: 'enquiry' });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Enquiry template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get enquiry template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * PUT /api/templates/enquiry
 * Update enquiry form template (admin only)
 */
router.put('/enquiry', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fields } = req.body;

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        error: 'Fields array is required'
      });
    }

    const template = await FormTemplate.findOneAndUpdate(
      { type: 'enquiry' },
      { fields, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Update enquiry template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
});

/**
 * GET /api/templates/admission
 * Get admission form template
 */
router.get('/admission', async (req, res: Response) => {
  try {
    const template = await FormTemplate.findOne({ type: 'admission' });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Admission template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get admission template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * PUT /api/templates/admission
 * Update admission form template (admin only)
 */
router.put('/admission', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fields } = req.body;

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        error: 'Fields array is required'
      });
    }

    const template = await FormTemplate.findOneAndUpdate(
      { type: 'admission' },
      { fields, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Update admission template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
});

/**
 * GET /api/templates/documents
 * Get required documents list
 */
router.get('/documents', async (req, res: Response) => {
  try {
    const docsList = await DocumentsList.findOne();

    if (!docsList) {
      return res.status(404).json({
        success: false,
        error: 'Documents list not found'
      });
    }

    res.json({
      success: true,
      data: docsList
    });
  } catch (error) {
    console.error('Get documents list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents list'
    });
  }
});

/**
 * PUT /api/templates/documents
 * Update required documents list (admin only)
 */
router.put('/documents', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: 'Documents array is required'
      });
    }

    // Find existing or create new
    let docsList = await DocumentsList.findOne();

    if (docsList) {
      docsList.documents = documents;
      docsList.updatedAt = new Date();
      await docsList.save();
    } else {
      docsList = await DocumentsList.create({ documents });
    }

    res.json({
      success: true,
      data: docsList
    });
  } catch (error) {
    console.error('Update documents list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update documents list'
    });
  }
});

export default router;
