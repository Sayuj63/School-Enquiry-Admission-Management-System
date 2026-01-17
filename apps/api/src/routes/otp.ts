import { Router, Response } from 'express';
import { sendOTP, verifyOTP } from '../services';

const router: Router = Router();

/**
 * POST /api/otp/send
 * Send OTP to mobile number
 */
router.post('/send', async (req, res: Response) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number is required'
      });
    }

    const result = await sendOTP(mobile);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }

    // In dev mode, return OTP for testing
    const response: any = {
      success: true,
      message: result.message
    };

    if ((process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') && result.otp) {
      response.otp = result.otp;
      response.expiresAt = result.expiresAt;
      response.mobile = result.mobile;
    }

    res.json(response);
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP'
    });
  }
});

/**
 * POST /api/otp/verify
 * Verify OTP
 */
router.post('/verify', async (req, res: Response) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number and OTP are required'
      });
    }

    const result = await verifyOTP(mobile, otp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP'
    });
  }
});

export default router;
