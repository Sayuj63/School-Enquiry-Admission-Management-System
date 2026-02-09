'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Phone, Mail, MapPin, Calendar, CheckCircle, Loader2, MessageCircle } from 'lucide-react'
import { getEnquiry, createAdmission, getEnquiryTemplate, resendNotification } from '@/lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface Enquiry {
  _id: string
  tokenId: string
  parentName: string
  childName: string
  mobile: string
  mobileVerified: boolean
  email: string
  city: string
  grade: string
  message: string
  status: 'token_number_generated' | 'draft' | 'in_progress' | 'converted' | 'pending_admission'
  additionalFields?: Record<string, any>
  whatsappSent: boolean
  createdAt: string
}

const statusColors = {
  token_number_generated: 'bg-blue-100 text-blue-800',
  draft: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-orange-100 text-orange-800',
  pending_admission: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-green-100 text-green-800'
}

const statusLabels = {
  token_number_generated: 'token number generated',
  draft: 'Draft (Incomplete)',
  in_progress: 'Draft (Incomplete)',
  pending_admission: 'Pending Admission',
  converted: 'Admission Approved'
}

export default function EnquiryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const enquiryId = params.id as string

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null)
  const [templateFields, setTemplateFields] = useState<any[]>([])
  const [hasAdmission, setHasAdmission] = useState(false)
  const [admissionId, setAdmissionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      const [enquiryResult, templateResult] = await Promise.all([
        getEnquiry(enquiryId),
        getEnquiryTemplate()
      ])

      if (enquiryResult.success && enquiryResult.data) {
        setEnquiry(enquiryResult.data.enquiry)
        setHasAdmission(enquiryResult.data.hasAdmission)
        setAdmissionId(enquiryResult.data.admissionId)
      }

      if (templateResult.success && templateResult.data) {
        setTemplateFields(templateResult.data.fields || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [enquiryId])

  const handleCreateAdmission = async () => {
    setCreating(true)
    setError('')

    const result = await createAdmission(enquiryId)

    if (result.success && result.data) {
      router.push(`/admin/admissions/${result.data._id}`)
    } else {
      setError(result.error || 'Failed to create admission form')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!enquiry) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Enquiry not found</p>
        <Link href="/admin/enquiries" className="text-primary-600 hover:underline mt-4 inline-block">
          Back to Enquiries
        </Link>
      </div>
    )
  }

  // Get additional fields from template that have values in enquiry
  const dynamicFields = templateFields.filter(f => {
    const standardKeys = ['parentName', 'childName', 'mobile', 'email', 'city', 'grade', 'message']
    return !standardKeys.includes(f.name) && enquiry.additionalFields?.[f.name] !== undefined
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/enquiries" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Enquiries
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{enquiry.childName}</h2>
            <p className="font-mono text-gray-500">{enquiry.tokenId}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full w-fit ${statusColors[enquiry.status] || 'bg-gray-100 text-gray-800'}`}>
            {statusLabels[enquiry.status] || enquiry.status}
          </span>
        </div>
      </div>

      {enquiry.status === 'draft' && (
        <div className="mb-6 bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-orange-900">Draft In Progress</p>
              <p className="text-xs text-orange-700">The parent has saved this enquiry as a draft and yet to submit.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs font-bold text-orange-800 uppercase tracking-wider">Completion</div>
            <div className="w-48 h-2 bg-orange-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(((dynamicFields.length + 7) / (templateFields.length || 1)) * 100))}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Main Info */}
        <div className="space-y-6">
          {/* Student Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Student Name</p>
                <p className="font-medium text-gray-900">{enquiry.childName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Grade Applying For</p>
                <p className="font-medium text-gray-900">{enquiry.grade}</p>
              </div>
            </div>
          </div>

          {/* Parent Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Parent/Guardian Information</h3>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{enquiry.parentName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{enquiry.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-900 font-medium">{enquiry.mobile}</span>
                  {enquiry.mobileVerified && (
                    <span className="ml-2 inline-flex items-center text-green-600 text-xs font-semibold px-2 py-0.5 bg-green-50 rounded-full border border-green-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </span>
                  )}
                </div>
                {enquiry.city && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-900 font-medium">{enquiry.city}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Additional Fields */}
          {dynamicFields.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
              <div className="grid sm:grid-cols-2 gap-6">
                {dynamicFields.map(field => {
                  const val = enquiry.additionalFields?.[field.name]
                  return (
                    <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <p className="text-sm text-gray-500 mb-1">{field.label}</p>
                      {field.type === 'checkbox' ? (
                        <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${val ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {val ? 'Yes' : 'No'}
                        </div>
                      ) : (
                        <p className="text-gray-900 font-medium whitespace-pre-wrap">{val || 'N/A'}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Message */}
          {enquiry.message && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Message / Remarks</h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">
                {enquiry.message}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {hasAdmission ? (
              <Link href={`/admin/admissions/${admissionId}`} className="btn-primary w-full justify-center">
                <FileText className="h-4 w-4 mr-2" />
                View Admission Form
              </Link>
            ) : enquiry.status !== 'draft' && (
              <button
                onClick={handleCreateAdmission}
                disabled={creating}
                className="btn-primary w-full justify-center"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Admission Form
                  </>
                )}
              </button>
            )}

            {enquiry.status !== 'draft' && (
              <button
                onClick={async () => {
                  setCreating(true)
                  const res = await resendNotification(enquiryId)
                  setCreating(false)
                  if (res.success) {
                    toast.success('Notifications resent successfully!')
                    // Update local state is optional as the Enquiry detail already shows whatsappSent status
                    setEnquiry(prev => prev ? { ...prev, whatsappSent: true } : null)
                  } else {
                    setError(res.error || 'Failed to resend notifications')
                  }
                }}
                disabled={creating}
                className="btn-secondary w-full justify-center mt-3"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                Resend Notifications
              </button>
            )}
          </div>

          {/* Meta Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Submitted On</p>
                  <p className="text-gray-900">
                    {format(new Date(enquiry.createdAt), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">WhatsApp Sent</p>
                <p className={enquiry.whatsappSent ? 'text-green-600' : 'text-gray-500'}>
                  {enquiry.whatsappSent ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
