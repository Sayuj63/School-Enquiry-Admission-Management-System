'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { GraduationCap, ArrowLeft, Loader2, CheckCircle, Calendar, Save, FileText, Info, PlusCircle, ChevronRight, User, Upload, Trash2, X, LogOut } from 'lucide-react'
import { sendOTP, verifyOTP, submitEnquiry, getEnquiryTemplate, getGradeRules, getAvailableSlots, getEnquiryDraft, lookupEnquiries, getEnquiriesByMobile, getExistingBookingByMobile, getDocumentsList, uploadParentDocument, uploadEnquiryDraftDocument, deleteEnquiryDraftDocument } from '@/lib/api'
import ConfirmModal from '@/app/components/ConfirmModal'

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

function EnquiryContent() {
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
  const [hasOtherEnquiries, setHasOtherEnquiries] = useState(false)
  const [requiredDocs, setRequiredDocs] = useState<any[]>([])
  const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: any }>({})
  const [pendingFiles, setPendingFiles] = useState<{ [key: string]: File }>({})
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({})
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } })

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

    // Validate cutOffDate format MM-DD
    const cutOffRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
    if (!gradeSettings.cutOffDate || !cutOffRegex.test(gradeSettings.cutOffDate)) {
      console.error('Invalid cutOffDate setting:', gradeSettings.cutOffDate);
      return [];
    }

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

  // Note: Autosave restoration removed to prevent cross-application data leakage
  // Autosave still works during form editing, but won't pre-populate new applications

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templateRes, settingsRes, slotsRes, docsRes] = await Promise.all([
          getEnquiryTemplate(),
          getGradeRules(),
          getAvailableSlots(),
          getDocumentsList()
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

        if (docsRes.success) {
          setRequiredDocs(docsRes.data.documents || [])
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
              } else if (key === 'documents' && Array.isArray(draftData[key])) {
                const docsMap: { [key: string]: any } = {}
                draftData[key].forEach((doc: any) => {
                  docsMap[doc.type] = doc
                })
                setUploadedDocs(docsMap)
              } else {
                setValue(key, draftData[key])
              }
            })

            setOtpVerified(true)
          }
        } else {
          // CHECK PERSISTENT SESSION (Requirement: stay logged in for 2 hours)
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

                // Check if they have other enquiries (silently)
                lookupEnquiries(session.mobile).then(res => {
                  if (res.success && res.data.enquiries.length > 0) {
                    setHasOtherEnquiries(true)
                  }
                }).catch(e => console.error('Silent enquiry check failed', e))
              } else {
                setValue('mobile', session.mobile)
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
        expires: new Date().getTime() + (120 * 60 * 1000)
      }
      localStorage.setItem('parent_session', JSON.stringify(session))

      // Clear any previous autosave for this mobile to start fresh
      localStorage.removeItem(`enquiry_autosave_${mobileValue}`)

      // Check if user has enquiries
      const enquiriesRes = await lookupEnquiries(mobileValue)
      if (enquiriesRes.success && enquiriesRes.data.enquiries.length > 0) {
        setHasOtherEnquiries(true)
        // Redirect to applications page to show list
        router.replace('/parent/applications')
      } else {
        setHasOtherEnquiries(false)
        // Stay on form to complete the enquiry
        setStep('form')
      }
    } else {
      setError(result.error || 'Invalid OTP')
    }
  }



  const handleFileChange = (type: string, file: File | null) => {
    if (!file) {
      const newFiles = { ...pendingFiles }
      delete newFiles[type]
      setPendingFiles(newFiles)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${type}: File size exceeds 5MB limit`)
      return
    }

    setPendingFiles(prev => ({ ...prev, [type]: file }))
  }

  const onSaveDraft = async () => {
    const data = watch()
    if (!otpVerified) {
      setError('Please verify mobile before saving draft')
      return
    }
    setLoading(true)
    const result = await submitEnquiry({ ...data, status: 'draft' })

    if (result.success) {
      const enquiryId = result.data?.id
      if (enquiryId) {
        // UPLOAD PENDING DOCUMENTS
        const fileTypes = Object.keys(pendingFiles)
        if (fileTypes.length > 0) {
          toast.loading('Uploading documents...', { id: 'upload-draft' })
          let uploadErrors: string[] = []

          for (const type of fileTypes) {
            setUploadProgress(prev => ({ ...prev, [type]: true }))
            try {
              const uploadResult = await uploadEnquiryDraftDocument(enquiryId, type, pendingFiles[type])
              if (!uploadResult.success) {
                uploadErrors.push(`${type}: ${uploadResult.error || 'Upload failed'}`)
              }
            } catch (fileErr: any) {
              uploadErrors.push(`${type}: Upload failed`)
            }
            setUploadProgress(prev => ({ ...prev, [type]: false }))
          }

          if (uploadErrors.length === 0) {
            toast.success('Documents saved with draft', { id: 'upload-draft' })
          } else {
            toast.error(`Some documents failed to save: ${uploadErrors.join(', ')}`, { id: 'upload-draft' })
          }
        }
      }

      setLoading(false)
      // Clear autosave since draft is now saved on server
      localStorage.removeItem(`enquiry_autosave_${mobileValue}`)
      toast.success('Draft saved successfully! You can resume it later using your mobile number.')
      router.push('/')
    } else {
      setLoading(false)
      toast.error(result.error || 'Failed to save draft')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('parent_session');
    router.push('/');
  }


  const onSubmit = async (data: any, isWaitlistOverride = false) => {
    if (!otpVerified) {
      setError('Please verify your mobile number first')
      return
    }

    const isWaitlisted = isWaitlistOverride || selectedGradeFull
    const noSlotsAvailable = !isWaitlisted && availableSlots.length === 0

    if (noSlotsAvailable) {
      toast.error('No slots available. Saving your application as draft.')
      onSaveDraft()
      return
    }

    if (!selectedSlotId && !isWaitlisted) {
      setError('Please select a counselling slot')
      return
    }

    setStep('submitting')
    setError('')

    const result = await submitEnquiry({
      ...data,
      slotId: isWaitlisted ? undefined : selectedSlotId,
      status: 'token_number_generated',
      waitlist: isWaitlisted
    })

    if (result.success && result.data?.tokenId) {
      const tokenId = result.data.tokenId
      localStorage.removeItem(`enquiry_autosave_${mobileValue}`)

      // UPLOAD PENDING DOCUMENTS
      const fileTypes = Object.keys(pendingFiles)
      if (fileTypes.length > 0) {
        toast.loading('Uploading documents...', { id: 'upload' })
        let uploadErrors: string[] = []

        try {
          for (const type of fileTypes) {
            setUploadProgress(prev => ({ ...prev, [type]: true }))
            try {
              const uploadResult = await uploadParentDocument(tokenId, type, pendingFiles[type])
              if (!uploadResult.success) {
                uploadErrors.push(`${type}: ${uploadResult.error || 'Upload failed'}`)
              }
            } catch (fileErr: any) {
              const errorMsg = fileErr.message?.includes('timeout')
                ? 'Upload timed out'
                : fileErr.message?.includes('Failed to fetch')
                  ? 'Network error'
                  : 'Upload failed'
              uploadErrors.push(`${type}: ${errorMsg}`)
            }
            setUploadProgress(prev => ({ ...prev, [type]: false }))
          }

          if (uploadErrors.length === 0) {
            toast.success('Documents uploaded successfully', { id: 'upload' })
          } else if (uploadErrors.length < fileTypes.length) {
            toast.error(`Some documents failed: ${uploadErrors.join(', ')}. You can upload them later from the Status page.`, { id: 'upload' })
          } else {
            toast.error('All documents failed to upload. You can upload them later from the Status page.', { id: 'upload' })
          }
        } catch (err) {
          console.error('Document upload failed', err)
          toast.error('Document upload encountered an error. You can upload them later from the Status page.', { id: 'upload' })
        }
      }

      router.push(`/success/${tokenId}${isWaitlisted ? '?waitlist=true' : ''}`)
    } else if ((result as any).errorCode === 'GRADE_FULL') {
      setStep('form')
      setConfirmModal({
        isOpen: true,
        title: 'Grade Full - Join Waitlist?',
        message: `Admissions for ${data.grade} are currently full. Would you like to join the waitlist? You won't need to book a counselling slot now.`,
        onConfirm: () => onSubmit(data, true)
      })
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
            <div className="flex flex-col items-end gap-2 text-right">
              <div className="flex gap-2">
                <button
                  onClick={onSaveDraft}
                  className="flex items-center text-sm font-medium text-gray-500 hover:text-primary-600 transition-colors bg-white px-4 py-2 rounded-lg border shadow-sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Draft
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center text-sm font-medium text-red-500 hover:text-red-600 transition-colors bg-white px-4 py-2 rounded-lg border shadow-sm"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>

        {step === 'otp' && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-2xl font-bold mb-2">Verify Mobile</h2>
              <p className="text-gray-600 mb-6">Enter the 6-digit code sent to <span className="font-bold text-gray-900">+91 {mobileValue}</span></p>
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
                    <div key={field.name} className="flex flex-col">
                      <label className="label">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                      <select className={`input ${errorMessage ? 'input-error' : ''}`} {...register(field.name, rules)}>
                        <option value="">Select Grade</option>
                        {(dobValue ? filteredGrades : gradeRules.map(r => ({ grade: r.grade, isFull: r.isFull }))).map(opt => (
                          <option key={opt.grade} value={opt.grade}>
                            {opt.grade} {opt.isFull ? '(Waitlist Only)' : ''}
                          </option>
                        ))}
                      </select>
                      {errorMessage ? (
                        <p className="error-text">{errorMessage}</p>
                      ) : (
                        !dobValue && <p className="text-[10px] text-gray-400 mt-1 flex items-center"><Info className="h-3 w-3 mr-1" /> Select DoB first to see eligible grades.</p>
                      )}
                    </div>
                  )
                }

                return (
                  <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="label">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                    {field.name === 'mobile' ? (
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 font-medium">
                            <span className="text-sm border-r border-gray-200 pr-2">+91</span>
                          </div>
                          <input type="tel" className="input pl-14 w-full" {...register(field.name, rules)} disabled={otpVerified} />
                        </div>
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

          {/* Optional Document Upload Section */}
          <div className="card p-8">
            <h2 className="text-xl font-bold mb-2 flex items-center">
              <Upload className="h-5 w-5 mr-2 text-primary-600" />
              Required Documents (Optional)
            </h2>
            <p className="text-sm text-gray-500 mb-6">You can upload documents now or do it later from the application status page.</p>

            <div className="grid md:grid-cols-2 gap-6">
              {requiredDocs.map((doc) => {
                const docType = doc.name
                return (
                  <div key={docType} className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">{docType} {doc.required && <span className="text-red-500">*</span>}</label>
                    {uploadedDocs[docType] ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl group">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-green-700 block truncate">{uploadedDocs[docType].fileName}</span>
                          <span className="text-[10px] text-green-500 uppercase font-black">Saved in Draft</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (resumeId) {
                              const result = await deleteEnquiryDraftDocument(resumeId, uploadedDocs[docType]._id)
                              if (result.success) {
                                const newDocs = { ...uploadedDocs }
                                delete newDocs[docType]
                                setUploadedDocs(newDocs)
                                toast.success('Document removed')
                              } else {
                                toast.error('Failed to remove document')
                              }
                            }
                          }}
                          className="p-1 hover:bg-white rounded-lg transition-colors text-green-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : pendingFiles[docType] ? (
                      <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-100 rounded-xl group">
                        <FileText className="h-5 w-5 text-primary-600" />
                        <span className="text-xs font-medium text-primary-700 flex-1 truncate">{pendingFiles[docType].name}</span>
                        <button
                          type="button"
                          onClick={() => handleFileChange(docType, null)}
                          className="p-1 hover:bg-white rounded-lg transition-colors text-primary-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative group">
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => handleFileChange(docType, e.target.files?.[0] || null)}
                          accept="image/*,.pdf"
                        />
                        <div className="p-4 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center gap-2 group-hover:border-primary-200 group-hover:bg-gray-50 transition-all">
                          <PlusCircle className="h-4 w-4 text-gray-400 group-hover:text-primary-600" />
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-primary-600">Select File</span>
                        </div>
                      </div>
                    )}
                    {uploadProgress[docType] && (
                      <div className="flex items-center gap-2 text-[10px] text-primary-600 font-bold animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[10px] text-blue-700 leading-relaxed uppercase font-black tracking-widest flex items-center">
                <Info className="h-3 w-3 mr-1" /> Note
              </p>
              <p className="text-xs text-blue-600 mt-1">Accepted formats: PDF, JPEG, PNG. Max size: 5MB per file.</p>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                  <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
                    <button
                      onClick={() => {
                        setSlotChangedWarning(false)
                        if (existingBooking) setSelectedSlotId(existingBooking.slotId._id)
                      }}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <div className="flex items-start gap-4">
                      <div className="bg-amber-100 p-3 rounded-xl flex-shrink-0">
                        <Info className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Important Note</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          You already have a slot booked for another application. By choosing a different slot, you would have to visit the school twice.
                        </p>
                        <div className="flex gap-3 mt-6">
                          <button
                            onClick={() => {
                              setSlotChangedWarning(false)
                              if (existingBooking) setSelectedSlotId(existingBooking.slotId._id)
                            }}
                            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => setSlotChangedWarning(false)}
                            className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors"
                          >
                            I Understand
                          </button>
                        </div>
                      </div>
                    </div>
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
            {step === 'submitting' ? <Loader2 className="h-6 w-6 animate-spin" /> : (
              selectedGradeFull ? 'Join Waitlist' : (
                (!selectedGradeFull && availableSlots.length === 0) ? 'Save as Draft (No Slots Available)' : 'Confirm & Submit Application'
              )
            )}
          </button>
        </form>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          variant="warning"
          confirmText="Join Waitlist"
        />
      </div>
    </div>
  )
}

export default function EnquiryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
      </div>
    }>
      <EnquiryContent />
    </Suspense>
  )
}
