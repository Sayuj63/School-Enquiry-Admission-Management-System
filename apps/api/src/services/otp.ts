import { OTP } from '../models';
import { generateOTP } from '../utils/token';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 30;

interface SendOTPResult {
  success: boolean;
  message: string;
  otp?: string;
  expiresAt?: string;
  mobile?: string;
}

interface VerifyOTPResult {
  success: boolean;
  message: string;
}

/**
 * Normalize mobile number: remove all non-digits and add +91 prefix for 10-digit numbers
 */
function normalizeMobile(mobile: string): string {
  let normalized = mobile.replace(/\D/g, '');
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }
  return normalized;
}

/**
 * Send OTP to mobile number
 * In development mode, OTP is logged to console instead of being sent via SMS
 */
export async function sendOTP(mobile: string): Promise<SendOTPResult> {
  const normalizedMobile = normalizeMobile(mobile);

  // Check for existing unexpired OTP (cooldown)
  const existingOTP = await OTP.findOne({
    mobile: normalizedMobile,
    expiresAt: { $gt: new Date() },
    verified: false
  }).sort({ createdAt: -1 });

  if (existingOTP) {
    const timeSinceCreation = (Date.now() - existingOTP.createdAt.getTime()) / 1000;
    if (timeSinceCreation < RESEND_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(RESEND_COOLDOWN_SECONDS - timeSinceCreation);
      return {
        success: false,
        message: `Please wait ${waitTime} seconds before requesting a new OTP`
      };
    }
  }

  // Generate new OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Save to database
  await OTP.create({
    mobile: normalizedMobile,
    otp,
    expiresAt,
    attempts: 0,
    verified: false
  });

  // In development, log OTP instead of sending
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK_LOGS === 'true') {
    console.log('========================================');
    console.log('OTP SERVICE (MOCK MODE)');
    console.log('----------------------------------------');
    console.log(`Mobile: ${mobile}`);
    console.log(`OTP: ${otp}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    console.log('========================================');

    return {
      success: true,
      message: 'OTP sent successfully (dev mode)',
      otp,
      expiresAt: expiresAt.toISOString(),
      mobile
    };
  }

  // In production, send via Twilio
  if (process.env.NODE_ENV === 'production') {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !twilioNumber) {
        console.error('Twilio credentials missing in environment variables');
        // Fallback or skip
      } else {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: `Your OTP for New Era High School Admission is ${otp}. Valid for 10 minutes.`,
          from: twilioNumber,
          to: `+${normalizedMobile}`
        });
        console.log(`[PROD] OTP SMS sent successfully to +${normalizedMobile}`);
      }
    } catch (error) {
      console.error('Error sending OTP via Twilio:', error);
      // We don't want to block the user if SMS fails during trial/testing
      // but in production we might want to throw error.
      // For now, let's just log.
    }
  }

  return {
    success: true,
    message: 'OTP sent successfully'
  };
}

/**
 * Verify OTP for mobile number
 */
export async function verifyOTP(mobile: string, otpCode: string): Promise<VerifyOTPResult> {
  const normalizedMobile = normalizeMobile(mobile);

  // Find the latest unexpired OTP for this mobile
  const otpRecord = await OTP.findOne({
    mobile: normalizedMobile,
    expiresAt: { $gt: new Date() },
    verified: false
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return {
      success: false,
      message: 'OTP expired or not found. Please request a new OTP.'
    };
  }

  // Check attempts
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      message: 'Maximum attempts exceeded. Please request a new OTP.'
    };
  }

  // Increment attempts
  otpRecord.attempts += 1;
  await otpRecord.save();

  // Verify OTP
  if (otpRecord.otp !== otpCode) {
    const attemptsLeft = MAX_ATTEMPTS - otpRecord.attempts;
    return {
      success: false,
      message: attemptsLeft > 0
        ? `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
        : 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.'
    };
  }

  // Mark as verified
  otpRecord.verified = true;
  await otpRecord.save();

  console.log(`OTP verified successfully for ${mobile}`);

  return {
    success: true,
    message: 'OTP verified successfully'
  };
}

/**
 * Check if mobile is verified
 */
export async function isMobileVerified(mobile: string): Promise<boolean> {
  const normalizedMobile = normalizeMobile(mobile);

  const verifiedOTP = await OTP.findOne({
    mobile: normalizedMobile,
    verified: true,
    // Allow some grace period for form submission (2 hours)
    createdAt: { $gt: new Date(Date.now() - 120 * 60 * 1000) }
  });

  return !!verifiedOTP;
}
