'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { GraduationCap, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { sendOTP, verifyOTP, submitEnquiry, getEnquiryTemplate } from '@/lib/api'

interface FormField {
  name: string
  label: string
  type: string
  required: boolean
  options?: string[]
  order: number
  placeholder?: string
}

export default function EnquiryPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'otp' | 'submitting'>('form')
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<FormField[]>([])

  // OTP State
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)

  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm()

  const mobileValue = watch('mobile')

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const result = await getEnquiryTemplate()
        if (result.success && result.data && result.data.fields) {
          // Sort fields by order
          const sortedFields = result.data.fields.sort((a: FormField, b: FormField) => a.order - b.order)
          setFields(sortedFields)
        }
      } catch (err) {
        console.error('Failed to load form template', err)
        setError('Failed to load enquiry form. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplate()
  }, [])

  const handleSendOTP = async () => {
    if (!mobileValue || mobileValue.length < 10) {
      setError('Please enter a valid mobile number')
      return
    }

    // Set loading state for button
    // We reuse the main loading state, or creating a specific one would be better
    // For simplicity using local var or relying on UI feedback

    setError('')
    const result = await sendOTP(mobileValue)

    if (result.success) {
      setOtpSent(true)
      setStep('otp')
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

    setError('')
    const result = await verifyOTP(mobileValue, otpValue)

    if (result.success) {
      setOtpVerified(true)
      setStep('form')
    } else {
      setError(result.error || 'Invalid OTP')
    }
  }

  const onSubmit = async (data: any) => {
    if (!otpVerified) {
      setError('Please verify your mobile number first')
      return
    }

    setStep('submitting')
    setError('')

    // Map fields if necessary
    // Backend expects 'childName', template might use 'studentName'
    const payload = {
      ...data,
      childName: data.childName || data.studentName,
    }

    const result = await submitEnquiry(payload)

    if (result.success && result.data?.tokenId) {
      router.push(`/success/${result.data.tokenId}`)
    } else {
      setStep('form')
      setError(result.error || 'Failed to submit enquiry')
    }
  }

  if (loading && fields.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
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
                  disabled={otpValue.length !== 6}
                >
                  Verify OTP
                </button>
              </div>

              <button
                type="button"
                className="w-full mt-3 text-sm text-primary-600 hover:text-primary-700"
                onClick={handleSendOTP}
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
            {fields.map((field) => {
              const errorMessage = errors[field.name]?.message as string | undefined

              const rules: any = {
                required: field.required ? `${field.label} is required` : false
              }

              if (field.type === 'email') {
                rules.pattern = {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Please enter a valid email address'
                }
              }

              if (field.type === 'tel' || field.name === 'mobile') {
                rules.pattern = {
                  value: /^[+]?[\d\s-]{10,15}$/,
                  message: 'Please enter a valid mobile number'
                }
              }

              return (
                <div key={field.name}>
                  <label htmlFor={field.name} className="label">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.name === 'mobile' ? (
                    <div className="flex gap-3">
                      <input
                        id={field.name}
                        type="tel"
                        className={`input flex-1 ${errorMessage ? 'input-error' : ''}`}
                        placeholder="+91 XXXXX XXXXX"
                        {...register(field.name, {
                          ...rules,
                          onChange: (e) => {
                            e.target.value = e.target.value.replace(/\D/g, '')
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
                          className="btn-secondary whitespace-nowrap"
                          onClick={handleSendOTP}
                          disabled={!mobileValue}
                        >
                          Send OTP
                        </button>
                      )}
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={field.name}
                      rows={4}
                      className={`input ${errorMessage ? 'input-error' : ''}`}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      {...register(field.name, rules)}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={field.name}
                      className={`input ${errorMessage ? 'input-error' : ''}`}
                      {...register(field.name, rules)}
                    >
                      <option value="">Select an option</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id={field.name}
                          type="checkbox"
                          className={`h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${errorMessage ? 'border-red-500' : ''}`}
                          {...register(field.name, rules)}
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor={field.name} className="font-medium text-gray-700">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <input
                      id={field.name}
                      type={field.type}
                      className={`input ${errorMessage ? 'input-error' : ''}`}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      {...register(field.name, rules)}
                    />
                  )}

                  {errorMessage && (
                    <p className="error-text">{errorMessage}</p>
                  )}
                </div>
              )
            })}

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

            {!otpVerified && fields.some(f => f.name === 'mobile') && (
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
