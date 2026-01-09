'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, Trash2, Calendar, Loader2, CheckCircle } from 'lucide-react'
import { getAdmission, updateAdmission, uploadDocument, deleteDocument, getAvailableSlots, bookSlot, getAdmissionTemplate, getDocumentsList } from '@/lib/api'
import { format } from 'date-fns'

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
  const [bookingSlot, setBookingSlot] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    studentDob: '',
    parentAddress: '',
    parentOccupation: '',
    emergencyContact: '',
    status: 'draft',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [admissionId])

  const fetchData = async () => {
    setLoading(true)

    const [admissionResult, slotsResult, docsResult] = await Promise.all([
      getAdmission(admissionId),
      getAvailableSlots(),
      getDocumentsList()
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
        notes: adm.notes || ''
      })
    }

    if (slotsResult.success && slotsResult.data) {
      setAvailableSlots(slotsResult.data)
    }

    if (docsResult.success && docsResult.data) {
      setRequiredDocs(docsResult.data.documents || [])
    }

    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateAdmission(admissionId, formData)

    if (result.success) {
      setSuccess('Admission form saved successfully')
      setAdmission(result.data)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedDocType) return

    setUploading(true)
    setError('')

    const result = await uploadDocument(admissionId, file, selectedDocType)

    if (result.success) {
      fetchData()
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
      fetchData()
    } else {
      setError(result.error || 'Failed to delete document')
    }
  }

  const handleBookSlot = async (slotId: string) => {
    setBookingSlot(true)
    setError('')

    const result = await bookSlot(slotId, admissionId)

    if (result.success) {
      setShowSlotModal(false)
      setSuccess('Counselling slot booked successfully! Calendar invites are being sent.')
      fetchData()
    } else {
      setError(result.error || 'Failed to book slot')
    }

    setBookingSlot(false)
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
            Save Changes
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
        <div className="mb-6 bg-green-50 border border-green-200 rounded p-3">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pre-filled Info (Read-only) */}
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

          {/* Additional Info (Editable) */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Student Date of Birth</label>
                <input
                  type="date"
                  className="input"
                  value={formData.studentDob}
                  onChange={(e) => setFormData({ ...formData, studentDob: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Emergency Contact</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Residential Address</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Full address with PIN code"
                  value={formData.parentAddress}
                  onChange={(e) => setFormData({ ...formData, parentAddress: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Parent Occupation</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Software Engineer"
                  value={formData.parentOccupation}
                  onChange={(e) => setFormData({ ...formData, parentOccupation: e.target.value })}
                />
              </div>
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
                    <button
                      onClick={() => handleDeleteDocument(doc._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
          {/* Status */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            <select
              className="input"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

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
              </div>
            ) : (
              <button
                onClick={() => setShowSlotModal(true)}
                className="btn-primary w-full justify-center"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Counselling Slot
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slot Booking Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Select Counselling Slot</h2>

            {availableSlots.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No available slots</p>
            ) : (
              <div className="space-y-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot._id}
                    onClick={() => handleBookSlot(slot._id)}
                    disabled={bookingSlot}
                    className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{format(new Date(slot.date), 'EEE, dd MMM yyyy')}</p>
                        <p className="text-sm text-gray-500">{slot.startTime} - {slot.endTime}</p>
                      </div>
                      <span className="text-sm text-gray-500">
                        {slot.bookedCount}/{slot.capacity}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowSlotModal(false)}
              className="btn-secondary w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
