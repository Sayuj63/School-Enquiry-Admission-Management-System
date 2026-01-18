'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, Trash2, Calendar as CalendarIcon, Loader2, CheckCircle, User, Phone, GraduationCap, X, Clock } from 'lucide-react'
import { getAdmission, updateAdmission, uploadDocument, deleteDocument, getAvailableSlots, bookSlot, getAdmissionTemplate, getDocumentsList, cancelBooking, getCurrentUser } from '@/lib/api'
import { format } from 'date-fns'
import SlotCalendar from '../../../components/SlotCalendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'

interface Admission {
  _id: string
  tokenId: string
  studentName: string
  parentName: string
  mobile: string
  email: string
  grade: string
  studentDob?: string
  parentAddress?: string
  parentOccupation?: string
  emergencyContact?: string
  additionalFields: Record<string, any>
  documents: Array<{
    _id: string
    type: string
    fileName: string
    url: string
    uploadedAt: string
  }>
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  notes?: string
  slotBookingId?: string
}

interface Slot {
  _id: string
  date: string
  startTime: string
  endTime: string
  bookedCount: number
  capacity: number
  status: string
}

export default function AdmissionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const admissionId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [admission, setAdmission] = useState<Admission | null>(null)
  const [slotBooking, setSlotBooking] = useState<any>(null)
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
  const [requiredDocs, setRequiredDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState('')
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [bookingSlot, setBookingSlot] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    studentDob: '',
    parentAddress: '',
    parentOccupation: '',
    emergencyContact: '',
    status: 'draft',
    notes: '',
    additionalFields: {} as Record<string, any>
  })
  const [fields, setFields] = useState<any[]>([])
  const [baseFields, setBaseFields] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchData()
  }, [admissionId])

  const fetchData = async () => {
    setLoading(true)

    const [admissionResult, slotsResult, docsResult, templateResult, userResult] = await Promise.all([
      getAdmission(admissionId),
      getAvailableSlots(),
      getDocumentsList(),
      getAdmissionTemplate(),
      getCurrentUser()
    ])

    if (userResult.success) {
      setUser(userResult.data)
    }

    if (admissionResult.success && admissionResult.data) {
      const adm = admissionResult.data.admission
      setAdmission(adm)
      setSlotBooking(admissionResult.data.slotBooking)
      setFormData({
        studentDob: adm.studentDob ? format(new Date(adm.studentDob), 'yyyy-MM-dd') : '',
        parentAddress: adm.parentAddress || '',
        parentOccupation: adm.parentOccupation || '',
        emergencyContact: adm.emergencyContact || '',
        status: adm.status,
        notes: adm.notes || '',
        additionalFields: adm.additionalFields || {}
      })
    }

    if (slotsResult.success && slotsResult.data) {
      setAvailableSlots(slotsResult.data)
    }

    if (docsResult.success && docsResult.data) {
      setRequiredDocs(docsResult.data.documents || [])
    }

    if (templateResult.success && templateResult.data) {
      setFields(templateResult.data.fields || [])
      const bf = templateResult.data.baseFields || {}
      setBaseFields(bf instanceof Map ? Object.fromEntries(bf) : bf)
    }

    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    // Validate required fields
    const missingFields: string[] = []

    fields.forEach(field => {
      // 1. General Required Check
      if (field.required) {
        const isCore = ['studentDob', 'parentAddress', 'parentOccupation', 'emergencyContact'].includes(field.name)
        const value = isCore ? (formData as any)[field.name] : formData.additionalFields[field.name]

        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missingFields.push(field.label)
        }
      }

      // 2. Specific Format Validations
      if (field.name === 'emergencyContact') {
        const val = formData.emergencyContact
        if (val && val.length > 0 && val.length < 10) {
          missingFields.push('Emergency Contact Number must be at least 10 digits')
        }
        if (val && val === admission?.mobile) {
          missingFields.push('Emergency Contact Number cannot be the same as the primary Mobile number')
        }
      }
    })

    // Validate document upload (at least one document required)
    const hasDocuments = (admission?.documents || []).length > 0
    if (!hasDocuments) {
      missingFields.push('At least one document must be uploaded')
    }

    if (missingFields.length > 0) {
      setError(`Please complete the following requirements: ${missingFields.join(', ')}`)
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const updatedData = {
      ...formData,
      status: 'submitted'
    }

    const result = await updateAdmission(admissionId, updatedData)

    if (result.success) {
      setSuccess('Admission form submitted successfully')
      setAdmission(result.data)
      setFormData(prev => ({ ...prev, status: 'submitted' }))
    } else {
      setError(result.error || 'Failed to submit form')
    }

    setSaving(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedDocType) return

    setUploading(true)
    setError('')

    const result = await uploadDocument(admissionId, file, selectedDocType)

    if (result.success && result.data?.document) {
      setAdmission((prev) => prev ? {
        ...prev,
        documents: [...prev.documents, { ...result.data.document }]
      } : null)
      setSelectedDocType('')
    } else {
      setError(result.error || 'Failed to upload document')
    }

    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    const result = await deleteDocument(admissionId, docId)

    if (result.success) {
      setAdmission((prev) => prev ? {
        ...prev,
        documents: prev.documents.filter(d => d._id !== docId)
      } : null)
    } else {
      setError(result.error || 'Failed to delete document')
    }
  }

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot)
    setShowConfirmDialog(true)
  }

  const handleBookSlot = async () => {
    if (!selectedSlot) return

    setBookingSlot(true)
    setError('')

    const result = await bookSlot(selectedSlot._id, admissionId)

    if (result.success) {
      setShowSlotModal(false)
      setShowConfirmDialog(false)
      setSuccess(`✓ ${result.data?.message || 'Counselling slot saved successfully!'}`)
      fetchData()
    } else {
      setError(result.error || 'Failed to book slot')
    }

    setBookingSlot(false)
  }

  const handleCancelBooking = async () => {
    if (!slotBooking || !slotBooking.slotId?._id) return
    if (!confirm('Are you sure you want to cancel this counselling slot?')) return

    setCancelling(true)
    setError('')

    const result = await cancelBooking(slotBooking.slotId._id, slotBooking._id)

    if (result.success) {
      setSuccess('Counselling slot cancelled successfully')
      fetchData()
    } else {
      setError(result.error || 'Failed to cancel slot')
    }

    setCancelling(false)
  }

  const handleReschedule = () => {
    setShowSlotModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!admission) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Admission not found</p>
        <Link href="/admin/admissions" className="text-primary-600 hover:underline mt-4 inline-block">
          Back to Admissions
        </Link>
      </div>
    )
  }

  const isPrincipal = user?.role === 'principal'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/admissions" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Admissions
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Admission Form</h2>
              {admission.status === 'approved' && (
                <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
                  Accepted
                </span>
              )}
              {admission.status === 'rejected' && (
                <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-red-100 text-red-700 rounded-lg border border-red-200">
                  Rejected
                </span>
              )}
            </div>
            <p className="font-mono text-gray-500">{admission.tokenId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <>
              {admission.status === 'submitted' && slotBooking && (() => {
                const [year, month, day] = slotBooking.slotId.date.split('T')[0].split('-').map(Number)
                const [hours, minutes] = slotBooking.slotId.startTime.split(':').map(Number)
                const slotStartTime = new Date(year, month - 1, day, hours, minutes)
                const canDecide = slotStartTime <= new Date()

                if (!canDecide) {
                  return (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Buttons will appear during/after the meeting
                    </div>
                  )
                }

                return (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to approve this admission?')) {
                          const res = await updateAdmission(admissionId, { status: 'approved' })
                          if (res.success) {
                            setSuccess('Admission approved successfully')
                            fetchData()
                          }
                        }
                      }}
                      className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-none px-6"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt('Please enter reason for rejection:')
                        if (reason !== null) {
                          const res = await updateAdmission(admissionId, { status: 'rejected', notes: reason })
                          if (res.success) {
                            setSuccess('Admission rejected')
                            fetchData()
                          }
                        }
                      }}
                      className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Reject
                    </button>
                  </div>
                )
              })()}

              {admission.status === 'submitted' && !slotBooking && (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-lg border border-amber-100 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4" />
                  Book counselling to enable decisions
                </div>
              )}

              {!isPrincipal && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-secondary bg-white border-gray-200"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {admission.status === 'draft' ? 'Submit Form' : 'Save Changes'}
                </button>
              )}
            </>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {admission.status === 'approved' && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-900">This admission has been Accepted.</p>
            <p className="text-xs text-emerald-700">All documents and verification are complete.</p>
          </div>
        </div>
      )}
      {admission.status === 'rejected' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Trash2 className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-bold text-red-900">This admission has been Rejected.</p>
            {admission.notes && <p className="text-xs text-red-700">Reason: {admission.notes}</p>}
          </div>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded p-3 flex items-center justify-between">
          <p className="text-sm text-green-600">{success}</p>
          <button onClick={() => setSuccess('')} className="text-green-800 hover:text-green-900">✕</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Enquiry Information (Pre-filled)</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Student Name</label>
                <p className="input bg-gray-50">{admission.studentName}</p>
              </div>
              <div>
                <label className="label">Grade</label>
                <p className="input bg-gray-50">{admission.grade}</p>
              </div>
              <div>
                <label className="label">Parent Name</label>
                <p className="input bg-gray-50">{admission.parentName}</p>
              </div>
              <div>
                <label className="label">Mobile</label>
                <p className="input bg-gray-50">{admission.mobile}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email</label>
                <p className="input bg-gray-50">{admission.email}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map((field) => {
                const isCore = ['studentDob', 'parentAddress', 'parentOccupation', 'emergencyContact'].includes(field.name)
                let value = isCore ? (formData as any)[field.name] : formData.additionalFields[field.name]
                value = value || ''

                const handleChange = (e: any) => {
                  let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
                  if (field.type === 'tel' || field.name === 'emergencyContact') val = val.replace(/\D/g, '')

                  if (isCore) setFormData(p => ({ ...p, [field.name]: val }))
                  else setFormData(p => ({ ...p, additionalFields: { ...p.additionalFields, [field.name]: val } }))
                }

                return (
                  <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    {field.type !== 'checkbox' && (
                      <label className="label">{field.label} {field.required && '*'}</label>
                    )}
                    {field.type === 'textarea' ? (
                      <textarea className="input" rows={3} value={value} onChange={handleChange} disabled={isPrincipal} />
                    ) : field.type === 'select' ? (
                      <select className="input" value={value} onChange={handleChange} disabled={isPrincipal}>
                        <option value="">Select</option>
                        {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <input type="checkbox" checked={!!value} onChange={handleChange} disabled={isPrincipal} />
                        <label className="text-sm font-medium">{field.label}</label>
                      </div>
                    ) : (
                      <input type={field.type} className="input" value={value} onChange={handleChange} disabled={isPrincipal} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
            <div className="space-y-3 mb-4">
              {admission.documents.map((doc) => (
                <div key={doc._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{doc.type}</p>
                    <p className="text-sm text-gray-500">{doc.fileName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-primary-600 text-sm font-medium">View</a>
                    {!isPrincipal && <button onClick={() => handleDeleteDocument(doc._id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
            {!isPrincipal && (
              <div className="flex gap-3">
                <select className="input flex-1" value={selectedDocType} onChange={e => setSelectedDocType(e.target.value)}>
                  <option value="">Select type</option>
                  {requiredDocs.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  <option value="Other">Other</option>
                </select>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={!selectedDocType || uploading} className="btn-secondary">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Internal Notes</h3>
            <textarea
              className="input"
              rows={4}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              disabled={isPrincipal}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Counselling Slot</h3>
            {slotBooking ? (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center text-green-700 mb-2 font-medium">
                  <CheckCircle className="h-5 w-5 mr-2" /> Booked
                </div>
                <p className="text-sm text-green-600">{format(new Date(slotBooking.slotId.date), 'dd MMM yyyy')}</p>
                <p className="text-sm text-green-600">{slotBooking.slotId.startTime} - {slotBooking.slotId.endTime}</p>
                {!isPrincipal && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={handleReschedule} className="text-xs bg-white text-green-700 border border-green-200 px-2 py-1.5 rounded flex-1">Reschedule</button>
                    <button onClick={handleCancelBooking} disabled={cancelling} className="text-xs bg-white text-red-600 border border-red-100 px-2 py-1.5 rounded flex-1">
                      {cancelling ? '...' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSlotModal(true)}
                disabled={admission.status !== 'submitted' || isPrincipal}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                <CalendarIcon className="h-4 w-4 mr-2" /> Book Slot
              </button>
            )}
          </div>
        </div>
      </div>

      {showSlotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setShowSlotModal(false)} className="absolute top-4 right-4"><X /></button>
            <h2 className="text-xl font-semibold mb-4">Select Slot</h2>
            <SlotCalendar slots={availableSlots} type="available" onSelectSlot={handleSlotSelect} view="week" height={500} />
            <button onClick={() => setShowSlotModal(false)} className="btn-secondary w-full mt-4">Cancel</button>
          </div>
        </div>
      )}

      {showConfirmDialog && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Booking</h3>
            <p className="text-sm text-gray-600 mb-4">
              Slot: {format(new Date(selectedSlot.date), 'dd MMM yyyy')} | {selectedSlot.startTime} - {selectedSlot.endTime}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmDialog(false)} className="btn-secondary flex-1">No</button>
              <button onClick={handleBookSlot} disabled={bookingSlot} className="btn-primary flex-1">
                {bookingSlot ? 'Booking...' : 'Yes, Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
