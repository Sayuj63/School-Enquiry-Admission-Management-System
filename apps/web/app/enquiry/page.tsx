'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { GraduationCap, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { sendOTP, verifyOTP, submitEnquiry } from '@/lib/api'

interface EnquiryFormData {
  parentName: string
  childName: string
  mobile: string
  email: string
  city: string
  grade: string
  message: string
}

const GRADES = [
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12'
]

export default function EnquiryPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'otp' | 'submitting'>('form')
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<EnquiryFormData>()

  const mobileValue = watch('mobile')

  const handleSendOTP = async () => {
    if (!mobileValue || mobileValue.length < 10) {
      setError('Please enter a valid mobile number')
      return
    }

    setLoading(true)
    setError('')

    const result = await sendOTP(mobileValue)

    setLoading(false)

    if (result.success) {
      setOtpSent(true)
      setStep('otp')
      // In dev mode, show the OTP
      if (result.data?.otp) {
        setDevOtp(result.data.otp)
      }
    } else {
      setError(result.error || 'Failed to send OTP')
    }
  }

  const handleVerifyOTP = async () => {
    if (!otpValue || otpValue.length !== 6) {
      setError('Please enter a valid 6-digit OTP')
      return
    }

    setLoading(true)
    setError('')

    const result = await verifyOTP(mobileValue, otpValue)

    setLoading(false)

    if (result.success) {
      setOtpVerified(true)
      setStep('form')
    } else {
      setError(result.error || 'Invalid OTP')
    }
  }

  const onSubmit = async (data: EnquiryFormData) => {
    if (!otpVerified) {
      setError('Please verify your mobile number first')
      return
    }

    setStep('submitting')
    setLoading(true)
    setError('')

    const result = await submitEnquiry(data)

    setLoading(false)

    if (result.success && result.data?.tokenId) {
      router.push(`/success/${result.data.tokenId}`)
    } else {
      setStep('form')
      setError(result.error || 'Failed to submit enquiry')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
          <div className="flex items-center">
            <GraduationCap className="h-10 w-10 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 ml-3">
              Admission Enquiry
            </h1>
          </div>
          <p className="mt-2 text-gray-600">
            Fill out the form below to submit your enquiry. We&apos;ll get back to you shortly.
          </p>
        </div>

        {/* OTP Modal */}
        {step === 'otp' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold mb-4">Verify Mobile Number</h2>
              <p className="text-gray-600 mb-4">
                We&apos;ve sent an OTP to <strong>{mobileValue}</strong>
              </p>

              {devOtp && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Dev Mode:</strong> OTP is <span className="font-mono">{devOtp}</span>
                  </p>
                </div>
              )}

              <input
                type="text"
                className="input mb-4"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
              />

              {error && <p className="error-text mb-4">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setStep('form')
                    setError('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={handleVerifyOTP}
                  disabled={loading || otpValue.length !== 6}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verify OTP'
                  )}
                </button>
              </div>

              <button
                type="button"
                className="w-full mt-3 text-sm text-primary-600 hover:text-primary-700"
                onClick={handleSendOTP}
                disabled={loading}
              >
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="card">
          {error && step === 'form' && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Parent Name */}
            <div>
              <label htmlFor="parentName" className="label">
                Parent/Guardian Name <span className="text-red-500">*</span>
              </label>
              <input
                id="parentName"
                type="text"
                className={`input ${errors.parentName ? 'input-error' : ''}`}
                placeholder="Enter parent name"
                {...register('parentName', { required: 'Parent name is required' })}
              />
              {errors.parentName && (
                <p className="error-text">{errors.parentName.message}</p>
              )}
            </div>

            {/* Child Name */}
            <div>
              <label htmlFor="childName" className="label">
                Student Name <span className="text-red-500">*</span>
              </label>
              <input
                id="childName"
                type="text"
                className={`input ${errors.childName ? 'input-error' : ''}`}
                placeholder="Enter student name"
                {...register('childName', { required: 'Student name is required' })}
              />
              {errors.childName && (
                <p className="error-text">{errors.childName.message}</p>
              )}
            </div>

            {/* Mobile with OTP */}
            <div>
              <label htmlFor="mobile" className="label">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <input
                  id="mobile"
                  type="tel"
                  className={`input flex-1 ${errors.mobile ? 'input-error' : ''}`}
                  placeholder="+91 XXXXX XXXXX"
                  {...register('mobile', {
                    required: 'Mobile number is required',
                    pattern: {
                      value: /^[+]?[\d\s-]{10,15}$/,
                      message: 'Please enter a valid mobile number'
                    }
                  })}
                  disabled={otpVerified}
                />
                {otpVerified ? (
                  <div className="flex items-center gap-2 text-green-600 px-4">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Verified</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSendOTP}
                    disabled={loading || !mobileValue}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                  </button>
                )}
              </div>
              {errors.mobile && (
                <p className="error-text">{errors.mobile.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="email@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Please enter a valid email address'
                  }
                })}
              />
              {errors.email && (
                <p className="error-text">{errors.email.message}</p>
              )}
            </div>

            {/* City */}
            <div>
              <label htmlFor="city" className="label">
                City
              </label>
              <input
                id="city"
                type="text"
                className="input"
                placeholder="Enter city"
                {...register('city')}
              />
            </div>

            {/* Grade */}
            <div>
              <label htmlFor="grade" className="label">
                Class Applying For <span className="text-red-500">*</span>
              </label>
              <select
                id="grade"
                className={`input ${errors.grade ? 'input-error' : ''}`}
                {...register('grade', { required: 'Please select a class' })}
              >
                <option value="">Select a class</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              {errors.grade && (
                <p className="error-text">{errors.grade.message}</p>
              )}
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="label">
                Additional Remarks
              </label>
              <textarea
                id="message"
                rows={4}
                className="input"
                placeholder="Any additional information you'd like to share..."
                {...register('message')}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading || !otpVerified || step === 'submitting'}
            >
              {step === 'submitting' ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Submitting...
                </span>
              ) : (
                'Submit Enquiry'
              )}
            </button>

            {!otpVerified && (
              <p className="text-center text-sm text-gray-500">
                Please verify your mobile number before submitting
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
