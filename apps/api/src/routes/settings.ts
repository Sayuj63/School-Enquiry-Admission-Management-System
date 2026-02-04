import { Router, Response } from 'express';
import { GradeRule, GradeSettings } from '../models/GradeRule';
import { NotificationSettings } from '../models/NotificationSettings';
import { SlotSettings, Enquiry, Admission, SlotBooking, CounsellingSlot, AdminUser, ActivityLog } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';
import cloudinary from '../config/cloudinary';

const router: Router = Router();

/**
 * GET /api/settings/grade-rules
 * Get all grade rules and global settings
 */
router.get('/grade-rules', async (req, res: Response) => {
    try {
        const rules = await GradeRule.find().sort({ order: 1 });
        const enrichedRules = await Promise.all(rules.map(async rule => {
            const occupiedCount = await Admission.countDocuments({
                grade: rule.grade,
                status: { $in: ['confirmed', 'approved', 'submitted', 'draft'] }
            });
            const totalSeats = rule.totalSeats ?? 50;
            return {
                ...rule.toObject(),
                isFull: occupiedCount >= totalSeats,
                availableSeats: Math.max(0, totalSeats - occupiedCount),
                occupiedCount
            };
        }));

        let settings = await GradeSettings.findOne({ key: 'global' });

        if (!settings) {
            settings = await GradeSettings.create({ key: 'global' });
        }

        res.json({
            success: true,
            data: {
                rules: enrichedRules,
                settings
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch grade rules' });
    }
});

/**
 * GET /api/settings/notifications
 * Get notification settings
 */
router.get('/notifications', async (req, res: Response) => {
    try {
        let settings = await NotificationSettings.findOne({ key: 'notifications' });
        if (!settings) {
            settings = await NotificationSettings.create({ key: 'notifications' });
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch notification settings' });
    }
});

/**
 * PUT /api/settings/notifications
 */
router.put('/notifications', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const settings = await NotificationSettings.findOneAndUpdate(
            { key: 'notifications' },
            req.body,
            { upsert: true, new: true }
        );
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update notification settings' });
    }
});

/**
 * GET /api/settings/slots
 * Get slot settings
 */
router.get('/slots', async (req: AuthRequest, res: Response) => {
    try {
        let settings = await SlotSettings.findOne({ key: 'slots' });
        if (!settings) {
            settings = await SlotSettings.create({ key: 'slots' });
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch slot settings' });
    }
});

/**
 * PUT /api/settings/slots
 */
router.put('/slots', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const settings = await SlotSettings.findOneAndUpdate(
            { key: 'slots' },
            req.body,
            { upsert: true, new: true }
        );
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update slot settings' });
    }
});

/**
 * PUT /api/settings/grade-rules
 * Update grade rules (Admin only)
 */
router.put('/grade-rules', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { rules, settings } = req.body;

        if (settings) {
            await GradeSettings.findOneAndUpdate(
                { key: 'global' },
                settings,
                { upsert: true }
            );
        }

        if (rules && Array.isArray(rules)) {
            // For simplicity in this demo, we clear and re-insert
            await GradeRule.deleteMany({});
            await GradeRule.insertMany(rules);
        }

        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

/**
 * GET /api/settings/export
 * Export all admission/enquiry data to Excel
 */
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const admissions = await Admission.find().populate('enquiryId');

        const exportData = admissions.map(adm => {
            const enq = adm.enquiryId as any;
            return {
                'Token ID': adm.tokenId,
                'Student Name': adm.studentName,
                'Grade': adm.grade,
                'Email': adm.email,
                'Mobile': adm.mobile,
                'Parent Name': adm.parentName,
                'Status': adm.status,
                'City': adm.city,
                'Enquiry Date': enq ? format(new Date(enq.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A',
                'Last Updated': format(new Date(adm.updatedAt), 'yyyy-MM-dd HH:mm'),
                'Emergency Contact': adm.emergencyContact || 'N/A',
                'Address': adm.parentAddress || 'N/A',
                'Occupation': adm.parentOccupation || 'N/A'
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Admissions');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=admissions_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

/**
 * POST /api/settings/reset-cycle
 * Clear all transactional data (requires principal verification)
 */
router.post('/reset-cycle', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { principalEmail, principalPassword } = req.body;

        if (!principalEmail || !principalPassword) {
            return res.status(400).json({ success: false, error: 'Principal credentials required' });
        }

        const normalizedEmail = principalEmail.toLowerCase().trim();
        const principal = await AdminUser.findOne({ email: normalizedEmail, role: 'principal' });

        if (!principal) {
            console.log(`Reset attempt failed: Principal not found for email ${normalizedEmail} with role 'principal'`);
            return res.status(401).json({ success: false, error: 'Principal account not found' });
        }

        const isMatch = await principal.comparePassword(principalPassword);
        if (!isMatch) {
            console.log(`Reset attempt failed: Password mismatch for ${normalizedEmail}`);
            return res.status(401).json({ success: false, error: 'Invalid principal password' });
        }

        // Delete all assets from the "documents" folder in Cloudinary
        // This will ONLY delete assets in the "documents" folder/preset
        // Other folders (awards, beyond_acad, campus, unsigned, etc.) will remain unaffected
        try {
            console.log('Starting Cloudinary cleanup for "documents" folder...');

            // Delete all resources in the "documents" folder
            const cloudinaryResult = await cloudinary.api.delete_resources_by_prefix('documents/', {
                resource_type: 'image',
                type: 'upload'
            });

            console.log(`Cloudinary deletion result:`, cloudinaryResult);
            console.log(`Deleted ${Object.keys(cloudinaryResult.deleted || {}).length} assets from "documents" folder`);

            // Also try to delete any PDFs in the documents folder
            try {
                const pdfResult = await cloudinary.api.delete_resources_by_prefix('documents/', {
                    resource_type: 'raw',
                    type: 'upload'
                });
                console.log(`Deleted ${Object.keys(pdfResult.deleted || {}).length} PDF/raw assets from "documents" folder`);
            } catch (pdfError) {
                console.log('No PDF/raw assets found in documents folder or error deleting them:', pdfError);
            }

        } catch (cloudinaryError: any) {
            console.error('Cloudinary deletion error:', cloudinaryError);
            // Log but don't fail the entire reset if Cloudinary deletion fails
            console.warn('Warning: Cloudinary deletion failed, but continuing with database cleanup');
        }

        // Delete all database records
        await Promise.all([
            Enquiry.deleteMany({}),
            Admission.deleteMany({}),
            SlotBooking.deleteMany({}),
            CounsellingSlot.deleteMany({}),
            ActivityLog.deleteMany({})
        ]);

        res.json({ success: true, message: 'Admission cycle reset successful. All transaction data and documents cleared.' });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ success: false, error: 'Failed to reset admission cycle' });
    }
});

function format(date: Date, fmt: string): string {
    // Simple formatter for internal use to avoid adding more deps if possible, 
    // but date-fns is already in global use in some parts?
    // Let's check if we can use a simpler approach or if date-fns is available in api.
    return date.toISOString().replace('T', ' ').substring(0, 16);
}

export default router;
