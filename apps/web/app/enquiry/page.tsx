'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { GraduationCap, ArrowLeft, Loader2, CheckCircle, Calendar, Save, FileText, Info, PlusCircle, ChevronRight, User } from 'lucide-react'
import { sendOTP, verifyOTP, submitEnquiry, getEnquiryTemplate, getGradeRules, getAvailableSlots, getEnquiryDraft, getEnquiriesByMobile, getExistingBookingByMobile } from '@/lib/api'

interface FormField {
  name: string
  label: string
  type: string
  required: boolean
  options?: string[]
  order: number
  placeholder?: string
}

interface GradeRule {
  grade: string
  minAge: number
  isFull?: boolean
  availableSeats?: number
}

export default function EnquiryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume')
  const [step, setStep] = useState<'form' | 'otp' | 'submitting'>('form')
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<FormField[]>([])
  const [gradeRules, setGradeRules] = useState<GradeRule[]>([])
  const [gradeSettings, setGradeSettings] = useState<any>(null)
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')
  const [existingBooking, setExistingBooking] = useState<any>(null)
  const [slotChangedWarning, setSlotChangedWarning] = useState(false)

  // OTP State
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm()

  const mobileValue = watch('mobile')
  const dobValue = watch('dob')

  // Requirement 1.3.2: Grade Selection Logic
  const filteredGrades = useMemo(() => {
    if (!dobValue || !gradeRules.length || !gradeSettings) return []

    const birthDate = new Date(dobValue)
    const [month, day] = gradeSettings.cutOffDate.split('-').map(Number)

    // Academic Year Target: e.g. 2026
    const targetYear = 2026
    const cutOffDate = new Date(targetYear, month - 1, day)

    // Age on cut-off date
    let age = cutOffDate.getFullYear() - birthDate.getFullYear()
    const m = cutOffDate.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && cutOffDate.getDate() < birthDate.getDate())) {
      age--
    }

    // Eligible Grade: find highest rule where minAge <= age
    const eligibleRules = gradeRules.filter(r => r.minAge <= age)
    if (eligibleRules.length === 0) return []

    const baseGradeIndex = gradeRules.indexOf(eligibleRules[eligibleRules.length - 1])

    // Additional grades allowed (1.3.2)
    const maxGradeIndex = Math.min(gradeRules.length - 1, baseGradeIndex + gradeSettings.additionalGradesAllowed)

    return gradeRules.slice(0, maxGradeIndex + 1).map(r => ({
      grade: r.grade,
      isFull: r.isFull
    }))
  }, [dobValue, gradeRules, gradeSettings])

  const selectedGrade = watch('grade')
  const selectedGradeFull = useMemo(() => {
    if (!selectedGrade || !gradeRules.length) return false
    const rule = gradeRules.find(r => r.grade === selectedGrade)
    return rule?.isFull || false
  }, [selectedGrade, gradeRules])

  // Requirement: Autosave to localStorage
  useEffect(() => {
    const subscription = watch((value) => {
      // Only autosave if mobile is verified and we are in the form step
      if (otpVerified && step === 'form') {
        localStorage.setItem(`enquiry_autosave_${mobileValue}`, JSON.stringify(value))
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, otpVerified, step, mobileValue])

  // Requirement: Restore autosave after verification
  useEffect(() => {
    if (otpVerified && step === 'form' && !resumeId) {
      const saved = localStorage.getItem(`enquiry_autosave_${mobileValue}`)
      if (saved) {
        try {
          const data = JSON.parse(saved)
          Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
              setValue(key, data[key])
            }
          })
        } catch (e) {
          console.error('Failed to restore autosave', e)
        }
      }
    }
  }, [otpVerified, step, resumeId, mobileValue, setValue])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templateRes, settingsRes, slotsRes] = await Promise.all([
          getEnquiryTemplate(),
          getGradeRules(),
          getAvailableSlots()
        ])

        if (templateRes.success) {
          setFields(templateRes.data.fields.sort((a: any, b: any) => a.order - b.order))
        }

        if (settingsRes.success) {
          setGradeRules(settingsRes.data.rules)
          setGradeSettings(settingsRes.data.settings)
        }

        if (slotsRes.success) {
          setAvailableSlots(slotsRes.data)
        }

        // LOAD DRAFT DATA IF resumeId EXISTS
        if (resumeId) {
          const draftRes = await getEnquiryDraft(resumeId)
          if (draftRes.success && draftRes.data) {
            const draftData = draftRes.data

            // If it's already submitted, don't allow resuming as draft
            if (draftData.status !== 'draft' && draftData.tokenId) {
              router.push(`/parent/enquiry/${draftData.tokenId}`)
              return
            }

            // Map dob to YYYY-MM-DD for input[type=date]
            if (draftData.dob) {
              draftData.dob = new Date(draftData.dob).toISOString().split('T')[0]
            }

            // Populate form
            Object.keys(draftData).forEach(key => {
              if (key === 'additionalFields' && draftData[key]) {
                Object.keys(draftData[key]).forEach(subKey => {
                  setValue(subKey, draftData[key][subKey])
                })
              } else {
                setValue(key, draftData[key])
              }
            })

            setOtpVerified(true)
          }
        } else {
          // CHECK PERSISTENT SESSION (Requirement: stay logged in for 20 mins)
          const sessionStr = localStorage.getItem('parent_session')
          if (sessionStr) {
            try {
              const session = JSON.parse(sessionStr)
              const now = new Date().getTime()

              if (session.mobile && session.expires && now < session.expires) {
                setValue('mobile', session.mobile)
                setOtpVerified(true)

                // Fetch existing booking for this mobile
                const bookingRes = await getExistingBookingByMobile(session.mobile)
                if (bookingRes.success && bookingRes.data) {
                  setExistingBooking(bookingRes.data)
                  setSelectedSlotId(bookingRes.data.slotId._id)
                }
              } else {
                localStorage.removeItem('parent_session')
              }
            } catch (e) {
              console.error('Session parse error', e)
              localStorage.removeItem('parent_session')
            }
          }
        }
      } catch (err) {
        setError('Failed to load application data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [setValue, resumeId])

  // Auto-clear alerts after 5 seconds
  useEffect(() => {
    if (error || successMsg) {
      const timer = setTimeout(() => {
        setError('')
        setSuccessMsg('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, successMsg])

  const handleSendOTP = async () => {
    if (!mobileValue || mobileValue.length < 10) {
      setError('Please enter a valid mobile number')
      return
    }
    setError('')
    const result = await sendOTP(mobileValue)
    if (result.success) {
      setOtpSent(true)
      setStep('otp')
      if (result.data?.otp) setDevOtp(result.data.otp)
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

      // CREATE PERSISTENT SESSION (20 Minutes)
      const session = {
        mobile: mobileValue,
        expires: new Date().getTime() + (20 * 60 * 1000)
      }
      localStorage.setItem('parent_session', JSON.stringify(session))

      // Redirect to applications page to show list or "create new"
      router.push('/parent/applications')
    } else {
      setError(result.error || 'Invalid OTP')
    }
  }

  const onSaveDraft = async () => {
    const data = watch()
    if (!otpVerified) {
      setError('Please verify mobile before saving draft')
      return
    }
    setLoading(true)
    const result = await submitEnquiry({ ...data, status: 'draft' })
    setLoading(false)
    if (result.success) {
      toast.success('Draft saved successfully! You can resume it later using your mobile number.')
      router.push('/')
    } else {
      toast.error(result.error || 'Failed to save draft')
    }
  }


  const onSubmit = async (data: any, isWaitlistOverride = false) => {
    if (!otpVerified) {
      setError('Please verify your mobile number first')
      return
    }

    const isWaitlisted = isWaitlistOverride || selectedGradeFull

    if (!selectedSlotId && !isWaitlisted) {
      setError('Please select a counselling slot')
      return
    }

    setStep('submitting')
    setError('')

    const result = await submitEnquiry({
      ...data,
      slotId: isWaitlisted ? undefined : selectedSlotId,
      status: 'new',
      waitlist: isWaitlisted
    })

    if (result.success && result.data?.tokenId) {
      localStorage.removeItem(`enquiry_autosave_${mobileValue}`)
      router.push(`/success/${result.data.tokenId}${isWaitlisted ? '?waitlist=true' : ''}`)
    } else if ((result as any).errorCode === 'GRADE_FULL') {
      setStep('form')
      if (confirm(`Admissions for ${data.grade} are currently full. Would you like to join the waitlist? You won't need to book a counselling slot now.`)) {
        onSubmit(data, true)
      }
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <button onClick={() => router.back()} className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
            <div className="flex items-center">
              <GraduationCap className="h-10 w-10 text-primary-600" />
              <h1 className="text-3xl font-bold text-gray-900 ml-3">Admission Enquiry</h1>
            </div>
          </div>
          {otpVerified && (
            <button
              onClick={onSaveDraft}
              className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-600 transition-colors bg-white px-4 py-2 rounded-lg border shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Draft
            </button>
          )}
        </div>

        {step === 'otp' && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-2xl font-bold mb-2">Verify Mobile</h2>
              <p className="text-gray-600 mb-6">Enter the 6-digit code sent to <span className="font-bold text-gray-900">{mobileValue}</span></p>
              {devOtp && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-6 text-center">
                  <p className="text-sm text-yellow-800 font-medium">Dev Mode OTP: <span className="font-mono text-lg">{devOtp}</span></p>
                </div>
              )}
              <input
                type="text"
                className="input h-14 text-center text-2xl font-bold tracking-[0.5em] mb-6"
                placeholder="000000"
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
              />
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <button type="button" className="btn-secondary flex-1 h-12" onClick={() => setStep('form')}>Cancel</button>
                  <button type="button" className="btn-primary flex-1 h-12" onClick={handleVerifyOTP} disabled={otpValue.length !== 6}>Verify</button>
                </div>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="text-sm font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest"
                >
                  Resend OTP
                </button>
              </div>
            </div>
          </div>
        )}


        <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-8">
          <div className="card p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary-600" />
              Student Details
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {fields.map((field) => {
                const errorMessage = errors[field.name]?.message as string
                const rules: any = { required: field.required ? `${field.label} is required` : false }

                // Specific Logic for Grade Dropdown (1.3.2)
                if (field.name === 'grade') {
                  return (
                    <div key={field.name}>
                      <label className="label">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                      <select className={`input ${errorMessage ? 'input-error' : ''}`} {...register(field.name, rules)}>
                        <option value="">Select Grade</option>
                        {(dobValue ? filteredGrades : gradeRules.map(r => ({ grade: r.grade, isFull: r.isFull }))).map(opt => (
                          <option key={opt.grade} value={opt.grade}>
                            {opt.grade} {opt.isFull ? '(Waitlist Only)' : ''}
                          </option>
                        ))}
                      </select>
                      {errorMessage && <p className="error-text">{errorMessage}</p>}
                      {!dobValue && <p className="text-[10px] text-gray-400 mt-1 flex items-center"><Info className="h-3 w-3 mr-1" /> Select Date of Birth first to see eligible grades.</p>}
                    </div>
                  )
                }

                return (
                  <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="label">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                    {field.name === 'mobile' ? (
                      <div className="flex gap-3">
                        <input type="tel" className="input flex-1" {...register(field.name, rules)} disabled={otpVerified} />
                        {otpVerified ? (
                          <div className="flex items-center gap-2 text-green-600 px-4 py-2 font-bold bg-green-50 rounded-lg border border-green-100 h-11">
                            <CheckCircle className="h-5 w-5" /> Verified
                          </div>
                        ) : (
                          <button type="button" className="btn-secondary whitespace-nowrap" onClick={handleSendOTP} disabled={!mobileValue}>Send OTP</button>
                        )}
                      </div>
                    ) : field.type === 'select' ? (
                      <select className="input" {...register(field.name, rules)}>
                        <option value="">Select {field.label}</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea rows={3} className="input" {...register(field.name, rules)} />
                    ) : (
                      <input type={field.type} className="input" {...register(field.name, rules)} />
                    )}
                    {errorMessage && <p className="error-text">{errorMessage}</p>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Slot Booking Section (1.3.4) */}
          {!selectedGradeFull && (
            <div className="card p-8">
              <h2 className="text-xl font-bold mb-2 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-primary-600" />
                Counselling Slot
              </h2>
              <p className="text-sm text-gray-500 mb-6">Select a mandatory slot for your school visit and counselling session.</p>

              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableSlots.map(slot => (
                    <button
                      key={slot._id}
                      type="button"
                      onClick={() => {
                        setSelectedSlotId(slot._id)
                        if (existingBooking && slot._id !== existingBooking.slotId._id) {
                          setSlotChangedWarning(true)
                        } else {
                          setSlotChangedWarning(false)
                        }
                      }}
                      className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${selectedSlotId === slot._id
                        ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100'
                        : 'border-gray-100 bg-white hover:border-primary-200'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase">{new Date(slot.date).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                          <p className="font-bold text-gray-900">{new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          <p className="text-sm text-primary-700 font-medium mt-1">{slot.startTime}</p>
                        </div>
                        {existingBooking && slot._id === existingBooking.slotId._id && (
                          <div className="bg-primary-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Your Slot</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500">No available slots for the next 7 days. Please check back later or contact the school office.</p>
                </div>
              )}

              {slotChangedWarning && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-bold">Important Note</p>
                    <p className="text-xs text-amber-700">You already have a slot booked for another application. By choosing a different slot, you would have to visit the school twice.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedGradeFull && (
            <div className="card p-8 bg-amber-50 border-amber-200">
              <h2 className="text-xl font-bold mb-2 flex items-center text-amber-900">
                <Info className="h-5 w-5 mr-2 text-amber-600" />
                Waitlist Only
              </h2>
              <p className="text-sm text-amber-800">
                Admissions for <strong>{selectedGrade}</strong> are currently full. You can still submit your application to join the waitlist.
                Counselling slots are not required for waitlisted applications.
              </p>
            </div>
          )}

          {error && <p className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 font-medium">{error}</p>}
          {successMsg && <p className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 font-medium flex items-center"><CheckCircle className="h-4 w-4 mr-2" /> {successMsg}</p>}

          <button
            type="submit"
            className="btn-primary w-full h-14 text-lg font-bold shadow-xl shadow-primary-200 flex items-center justify-center transform active:scale-95 transition-transform"
            disabled={!otpVerified || step === 'submitting'}
          >
            {step === 'submitting' ? <Loader2 className="h-6 w-6 animate-spin" /> : (selectedGradeFull ? 'Join Waitlist' : 'Confirm & Submit Application')}
          </button>
        </form>
      </div>
    </div>
  )
}
