'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Phone, Mail, MapPin, Calendar, CheckCircle, Loader2 } from 'lucide-react'
import { getEnquiry, createAdmission } from '@/lib/api'
import { format } from 'date-fns'

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
  status: 'new' | 'in_progress' | 'converted'
  whatsappSent: boolean
  createdAt: string
}

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-green-100 text-green-800'
}

const statusLabels = {
  new: 'New',
  in_progress: 'In Progress',
  converted: 'Converted'
}

export default function EnquiryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const enquiryId = params.id as string

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null)
  const [hasAdmission, setHasAdmission] = useState(false)
  const [admissionId, setAdmissionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchEnquiry() {
      const result = await getEnquiry(enquiryId)
      if (result.success && result.data) {
        setEnquiry(result.data.enquiry)
        setHasAdmission(result.data.hasAdmission)
        setAdmissionId(result.data.admissionId)
      }
      setLoading(false)
    }

    fetchEnquiry()
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
          <span className={`px-3 py-1 text-sm font-medium rounded-full w-fit ${statusColors[enquiry.status]}`}>
            {statusLabels[enquiry.status]}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
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
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{enquiry.parentName}</p>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-900">{enquiry.mobile}</span>
                {enquiry.mobileVerified && (
                  <span className="ml-2 inline-flex items-center text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-900">{enquiry.email}</span>
              </div>
              {enquiry.city && (
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{enquiry.city}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          {enquiry.message && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Remarks</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{enquiry.message}</p>
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
            ) : (
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
