'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, Trash2, Calendar as CalendarIcon, Loader2, CheckCircle, User, Phone, GraduationCap } from 'lucide-react'
import { getAdmission, updateAdmission, uploadDocument, deleteDocument, getAvailableSlots, bookSlot, getAdmissionTemplate, getDocumentsList, cancelBooking } from '@/lib/api'
import { startOfWeek, getDay, parse, format } from 'date-fns'
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

    const [admissionResult, slotsResult, docsResult, templateResult] = await Promise.all([
      getAdmission(admissionId),
      getAvailableSlots(),
      getDocumentsList(),
      getAdmissionTemplate()
    ])

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
      // Scroll to top to see error
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Automatically set status to 'submitted' when Submit Form is clicked
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

  // Convert slots to calendar events
  const calendarEvents = availableSlots.map((slot) => {
    // Parse the date properly - slot.date comes from MongoDB as ISO string
    const slotDateObj = new Date(slot.date)
    const year = slotDateObj.getFullYear()
    const month = String(slotDateObj.getMonth() + 1).padStart(2, '0')
    const day = String(slotDateObj.getDate()).padStart(2, '0')

    // Create proper datetime strings in ISO format
    const dateStr = `${year}-${month}-${day}`
    const start = new Date(`${dateStr}T${slot.startTime}:00`)
    const end = new Date(`${dateStr}T${slot.endTime}:00`)

    const slotsLeft = slot.capacity - slot.bookedCount

    return {
      title: `${slotsLeft}/${slot.capacity} available`,
      start,
      end,
      resource: slot,
    }
  })

  const eventPropGetter = (event: any) => {
    const slot = event.resource as Slot
    const slotsLeft = slot.capacity - slot.bookedCount

    let className = ''
    if (slotsLeft === 0) {
      className = 'bg-red-100 text-red-800 border-red-200'
    } else if (slotsLeft <= 1) {
      className = 'bg-yellow-100 text-yellow-800 border-yellow-200'
    } else {
      className = 'bg-green-100 text-green-800 border-green-200'
    }

    return {
      className: `border rounded-md text-xs font-medium cursor-pointer ${className}`,
      style: {
        backgroundColor: undefined,
      }
    }
  }

  const EventComponent = ({ event }: any) => {
    return (
      <div className="h-full w-full flex items-center justify-center pointer-events-none">
        {event.title}
      </div>
    )
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
            <h2 className="text-2xl font-bold text-gray-900">Admission Form</h2>
            <p className="font-mono text-gray-500">{admission.tokenId}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Submit Form
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded p-3 flex items-center justify-between">
          <p className="text-sm text-green-600">{success}</p>
          <button onClick={() => setSuccess('')} className="text-green-800 hover:text-green-900">✕</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info (Read-only) */}
          {((baseFields.studentName !== false) || (baseFields.grade !== false) || (baseFields.parentName !== false) || (baseFields.mobile !== false) || (baseFields.email !== false)) && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Enquiry Information (Pre-filled)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {(baseFields.studentName !== false) && (
                  <div>
                    <label className="label">Student Name</label>
                    <p className="input bg-gray-50">{admission.studentName}</p>
                  </div>
                )}
                {(baseFields.grade !== false) && (
                  <div>
                    <label className="label">Grade</label>
                    <p className="input bg-gray-50">{admission.grade}</p>
                  </div>
                )}
                {(baseFields.parentName !== false) && (
                  <div>
                    <label className="label">Parent Name</label>
                    <p className="input bg-gray-50">{admission.parentName}</p>
                  </div>
                )}
                {(baseFields.mobile !== false) && (
                  <div>
                    <label className="label">Mobile</label>
                    <p className="input bg-gray-50">{admission.mobile}</p>
                  </div>
                )}
                {(baseFields.email !== false) && (
                  <div className="sm:col-span-2">
                    <label className="label">Email</label>
                    <p className="input bg-gray-50">{admission.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Info (Editable) */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map((field) => {
                const isCore = ['studentDob', 'parentAddress', 'parentOccupation', 'emergencyContact'].includes(field.name)

                // Determine value based on whether it's a core field or additional field
                let value = ''
                if (isCore) {
                  // Type safety casting for dynamic access
                  value = (formData as any)[field.name] || ''
                } else {
                  value = formData.additionalFields[field.name] || ''
                }

                // Handle change handler
                const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                  let val: any = e.target.value

                  if (e.target.type === 'checkbox') {
                    val = (e.target as HTMLInputElement).checked
                  }

                  // Filter non-numeric characters for tel type or specific fields
                  if (field.type === 'tel' || field.name === 'emergencyContact' || field.name === 'mobile') {
                    val = val.toString().replace(/\D/g, '')
                  }

                  if (isCore) {
                    setFormData(prev => ({ ...prev, [field.name]: val }))
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      additionalFields: { ...prev.additionalFields, [field.name]: val }
                    }))
                  }
                }

                return (
                  <div key={field.name} className={field.type === 'textarea' || field.type === 'address' ? 'sm:col-span-2' : ''}>
                    {field.type !== 'checkbox' && (
                      <label className="label">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                    )}
                    {field.type === 'textarea' ? (
                      <textarea
                        className="input"
                        rows={3}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        value={value}
                        onChange={handleChange}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="input"
                        value={value}
                        onChange={handleChange}
                      >
                        <option value="">Select option</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-200">
                        <input
                          type="checkbox"
                          id={field.name}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={!!value}
                          onChange={handleChange}
                        />
                        <label htmlFor={field.name} className="text-sm font-medium text-gray-700 cursor-pointer">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        className="input"
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        value={value}
                        onChange={handleChange}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>

            {/* Required Documents List */}
            {requiredDocs.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">Required Documents:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  {requiredDocs.map((doc, i) => (
                    <li key={i}>
                      {doc.name} {doc.required && <span className="text-red-500">*</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Uploaded Documents */}
            {admission.documents.length > 0 && (
              <div className="space-y-2 mb-4">
                {admission.documents.map((doc) => (
                  <div key={doc._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{doc.type}</p>
                      <p className="text-sm text-gray-500">{doc.fileName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDeleteDocument(doc._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload New */}
            <div className="flex gap-3">
              <select
                className="input flex-1"
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
              >
                <option value="">Select document type</option>
                {requiredDocs.map((doc, i) => (
                  <option key={i} value={doc.name}>{doc.name}</option>
                ))}
                <option value="Other">Other</option>
              </select>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedDocType || uploading}
                className="btn-secondary"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Internal Notes</h3>
            <textarea
              className="input"
              rows={4}
              placeholder="Admin notes (not visible to parents)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">


          {/* Counselling Slot */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Counselling Slot</h3>

            {slotBooking ? (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center text-green-700 mb-2">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Slot Booked</span>
                </div>
                <p className="text-sm text-green-600">
                  {format(new Date(slotBooking.slotId.date), 'dd MMM yyyy')}
                </p>
                <p className="text-sm text-green-600">
                  {slotBooking.slotId.startTime} - {slotBooking.slotId.endTime}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleReschedule}
                    className="text-xs bg-white text-green-700 border border-green-200 px-2 py-1.5 rounded hover:bg-green-100 transition-colors font-medium flex-1 text-center"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={handleCancelBooking}
                    disabled={cancelling}
                    className="text-xs bg-white text-red-600 border border-red-100 px-2 py-1.5 rounded hover:bg-red-50 transition-colors font-medium flex-1 text-center flex items-center justify-center gap-1"
                  >
                    {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setShowSlotModal(true)}
                  disabled={admission.status === 'draft'}
                  className={`btn-primary w-full justify-center ${admission.status === 'draft' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Book Counselling Slot
                </button>
                {admission.status === 'draft' && (
                  <p className="text-xs text-amber-600 flex items-start gap-1 bg-amber-50 p-2 rounded border border-amber-100 italic">
                    Form must be <strong>Submitted</strong> before booking a slot.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slot Booking Modal with Calendar */}
      {showSlotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Select Counselling Slot</h2>

            {/* Admission Summary */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Booking For:</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center text-blue-800">
                  <User className="h-4 w-4 mr-2" />
                  <span><strong>Student:</strong> {admission.studentName}</span>
                </div>
                <div className="flex items-center text-blue-800">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  <span><strong>Grade:</strong> {admission.grade}</span>
                </div>
                <div className="flex items-center text-blue-800">
                  <User className="h-4 w-4 mr-2" />
                  <span><strong>Parent:</strong> {admission.parentName}</span>
                </div>
                <div className="flex items-center text-blue-800">
                  <Phone className="h-4 w-4 mr-2" />
                  <span><strong>Mobile:</strong> {admission.mobile}</span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            {availableSlots.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No available slots</p>
            ) : (
              <div className="mb-6">
                <SlotCalendar
                  slots={availableSlots}
                  type="available"
                  onSelectSlot={handleSlotSelect}
                  showStats={false}
                  showFilters={false}
                  view="week"
                  height={500}
                />
              </div>
            )}

            <button
              onClick={() => setShowSlotModal(false)}
              className="btn-secondary w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Slot Booking</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Selected Slot:</p>
              <p className="font-medium text-gray-900">
                {format(new Date(selectedSlot.date), 'EEEE, dd MMMM yyyy')}
              </p>
              <p className="text-gray-700">
                {selectedSlot.startTime} - {selectedSlot.endTime}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Availability:</strong> {selectedSlot.capacity - selectedSlot.bookedCount}/{selectedSlot.capacity} slots left
              </p>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Student:</strong> {admission.studentName} ({admission.grade})
              </p>
              <p className="text-sm text-blue-800">
                <strong>Parent:</strong> {admission.parentName}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false)
                  setSelectedSlot(null)
                }}
                className="btn-secondary flex-1"
                disabled={bookingSlot}
              >
                Cancel
              </button>
              <button
                onClick={handleBookSlot}
                disabled={bookingSlot}
                className="btn-primary flex-1"
              >
                {bookingSlot ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
