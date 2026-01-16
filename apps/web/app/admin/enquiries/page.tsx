'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Plus, Calendar, X, Loader2, CheckCircle } from 'lucide-react'
import { getEnquiries, getEnquiryTemplate, adminSubmitEnquiry, sendOTP, verifyOTP } from '@/lib/api'
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns'

interface Enquiry {
  _id: string
  tokenId: string
  parentName: string
  childName: string
  mobile: string
  email: string
  grade: string
  status: 'new' | 'half_filled' | 'pending_admission' | 'converted'
  createdAt: string
  slotBooked?: boolean
  bookedCount?: number
  admissionStatus?: 'draft' | 'submitted' | 'approved' | 'rejected' | null
}

const statusColors: any = {
  new: 'bg-blue-100 text-blue-800',
  half_filled: 'bg-orange-100 text-orange-800',
  pending_admission: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-green-100 text-green-800'
}

const statusLabels = {
  new: 'New',
  half_filled: 'Half Filled',
  pending_admission: 'Pending Admission',
  converted: 'Completed'
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const initialDateFilter = dateParam && ['today', 'week', 'month'].includes(dateParam) ? dateParam : ''

  const [dateFilter, setDateFilter] = useState(initialDateFilter)
  const [classFilter, setClassFilter] = useState('')

  // Manual Entry Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [templateFields, setTemplateFields] = useState<any[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [creating, setCreating] = useState(false)
  const [modalSuccess, setModalSuccess] = useState('')
  const [modalError, setModalError] = useState('')

  // OTP State for Admin Modal
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  // Fetch when filters or debounced search changes
  useEffect(() => {
    setPage(1)
    fetchEnquiries()
  }, [debouncedSearch, statusFilter, dateFilter, classFilter])

  // Fetch when page changes
  useEffect(() => {
    fetchEnquiries()
  }, [page])

  const fetchEnquiries = async () => {
    setLoading(true)
    const result = await getEnquiries({
      page,
      limit: 10,
      status: statusFilter || undefined,
      search: debouncedSearch || undefined
    })

    if (result.success && result.data) {
      let filteredEnquiries = result.data.enquiries

      // Apply date filter client-side
      if (dateFilter) {
        const now = new Date()
        filteredEnquiries = filteredEnquiries.filter((enq: Enquiry) => {
          const enqDate = new Date(enq.createdAt)
          switch (dateFilter) {
            case 'today':
              return enqDate >= startOfDay(now)
            case 'week':
              return enqDate >= startOfWeek(now)
            case 'month':
              return enqDate >= startOfMonth(now)
            default:
              return true
          }
        })
      }

      // Apply class filter client-side
      if (classFilter) {
        filteredEnquiries = filteredEnquiries.filter((enq: Enquiry) =>
          enq.grade === classFilter
        )
      }

      setEnquiries(filteredEnquiries)
      setTotalPages(result.data.totalPages)
      setTotal(result.data.total)
    }
    setLoading(false)
  }

  const handleOpenAddModal = async () => {
    setShowAddModal(true)
    setModalError('')
    setModalSuccess('')
    setFormData({})
    setOtpSent(false)
    setOtpVerified(false)
    setOtpValue('')
    setDevOtp(null)

    const result = await getEnquiryTemplate()
    if (result.success && result.data) {
      setTemplateFields(result.data.fields || [])
    }
  }

  const handleSendOTP = async () => {
    const mobile = formData.mobile
    if (!mobile || mobile.length < 10) {
      setModalError('Please enter a valid mobile number')
      return
    }

    setSendingOtp(true)
    setModalError('')
    const result = await sendOTP(mobile)

    if (result.success) {
      setOtpSent(true)
      if (result.data?.otp) {
        setDevOtp(result.data.otp)
      }
    } else {
      setModalError(result.error || 'Failed to send OTP')
    }
    setSendingOtp(false)
  }

  const handleVerifyOTP = async () => {
    if (!otpValue || otpValue.length !== 6) {
      setModalError('Please enter a valid 6-digit OTP')
      return
    }

    setVerifyingOtp(true)
    setModalError('')
    const result = await verifyOTP(formData.mobile, otpValue)

    if (result.success) {
      setOtpVerified(true)
      setModalError('')
    } else {
      setModalError(result.error || 'Invalid OTP')
    }
    setVerifyingOtp(false)
  }

  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!otpVerified) {
      setModalError('Mobile number verification is required')
      return
    }

    if (!formData.privacyPolicy) {
      setModalError('Please confirm the Privacy Policy agreement')
      return
    }

    setCreating(true)
    setModalError('')
    setModalSuccess('')

    // Basic validation
    const requiredFields = templateFields.filter(f => f.required)
    for (const field of requiredFields) {
      if (!formData[field.name] && field.type !== 'checkbox') {
        setModalError(`${field.label} is required`)
        setCreating(false)
        return
      }
    }

    const payload = {
      ...formData,
      // Map names if needed (backend expects childName, template might use studentName or childName)
      childName: formData.childName || formData.studentName || formData.child_name,
    }

    const result = await adminSubmitEnquiry(payload)

    if (result.success) {
      setModalSuccess('Enquiry created successfully!')
      setTimeout(() => {
        setShowAddModal(false)
        fetchEnquiries()
      }, 1500)
    } else {
      setModalError(result.error || 'Failed to create enquiry')
    }
    setCreating(false)
  }

  const handleInputChange = (field: any, val: any) => {
    setFormData(prev => ({ ...prev, [field.name]: val }))
    // If mobile number changes, reset OTP status
    if (field.name === 'mobile') {
      setOtpSent(false)
      setOtpVerified(false)
      setOtpValue('')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Enquiries</h2>
          <p className="text-gray-600">{total} total enquiries</p>
        </div>
        <button onClick={handleOpenAddModal} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Enquiry
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card mb-6">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Search by Token ID or Mobile Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Date Filter */}
            <select
              className="input flex-1"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {/* Class Filter */}
            <select
              className="input flex-1"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">All Classes</option>
              <option value="Nursery">Nursery</option>
              <option value="LKG">LKG</option>
              <option value="UKG">UKG</option>
              <option value="Class 1">Class 1</option>
              <option value="Class 2">Class 2</option>
              <option value="Class 3">Class 3</option>
              <option value="Class 4">Class 4</option>
              <option value="Class 5">Class 5</option>
              <option value="Class 6">Class 6</option>
              <option value="Class 7">Class 7</option>
              <option value="Class 8">Class 8</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
            </select>

            <select
              className="input flex-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="half_filled">Half Filled</option>
              <option value="pending_admission">Pending Admission</option>
              <option value="converted">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : enquiries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No enquiries found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-900">{enquiry.tokenId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{enquiry.childName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{enquiry.parentName}</div>
                      <div className="text-sm text-gray-500">{enquiry.mobile}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {enquiry.grade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {enquiry.status === 'new' ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.new}`}>
                          {statusLabels.new}
                        </span>
                      ) : (enquiry as any).status === 'in_progress' || enquiry.status === 'pending_admission' ? (
                        enquiry.admissionStatus === 'draft' ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.half_filled}`}>
                            {statusLabels.half_filled}
                          </span>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.pending_admission}`}>
                            {statusLabels.pending_admission}
                          </span>
                        )
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.converted}`}>
                          {statusLabels.converted}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {enquiry.slotBooked ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Booked
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          Not Booked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(enquiry.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/enquiries/${enquiry._id}`}
                        className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Enquiry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="text-xl font-bold text-gray-900">Add Manual Enquiry</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {modalError && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
                  {modalSuccess}
                </div>
              )}

              <form onSubmit={handleCreateEnquiry} className="space-y-6">
                {templateFields.map((field) => (
                  <div key={field.name}>
                    {field.type !== 'checkbox' && (
                      <label className="label">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                    )}

                    {field.name === 'mobile' ? (
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <input
                            type="tel"
                            className="input flex-1"
                            placeholder="+91 XXXXX XXXXX"
                            value={formData.mobile || ''}
                            onChange={(e) => handleInputChange(field, e.target.value.replace(/\D/g, ''))}
                            disabled={otpVerified}
                            required={field.required}
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
                              disabled={!formData.mobile || sendingOtp}
                            >
                              {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : (otpSent ? 'Resend OTP' : 'Send OTP')}
                            </button>
                          )}
                        </div>

                        {otpSent && !otpVerified && (
                          <div className="space-y-3 p-4 bg-primary-50 rounded-lg border border-primary-100">
                            <p className="text-sm text-primary-800 font-medium">
                              We&apos;ve sent an OTP to {formData.mobile}
                            </p>
                            {devOtp && (
                              <p className="text-xs text-primary-600">
                                Dev Mode OTP: <span className="font-mono font-bold">{devOtp}</span>
                              </p>
                            )}
                            <div className="flex gap-3">
                              <input
                                type="text"
                                className="input flex-1 bg-white"
                                placeholder="Enter 6-digit OTP"
                                maxLength={6}
                                value={otpValue}
                                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                              />
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={handleVerifyOTP}
                                disabled={otpValue.length !== 6 || verifyingOtp}
                              >
                                {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        className="input"
                        rows={4}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        required={field.required}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="input"
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        required={field.required}
                      >
                        <option value="">Select option</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id={field.name}
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            checked={!!formData[field.name]}
                            onChange={() => handleInputChange(field, !formData[field.name])}
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
                        type={field.type}
                        className="input"
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}

                <div className="pt-2">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="privacyPolicy"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={!!formData.privacyPolicy}
                        onChange={(e) => setFormData(prev => ({ ...prev, privacyPolicy: e.target.checked }))}
                        required
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="privacyPolicy" className="font-medium text-gray-700">
                        I confirm that the parent/guardian has agreed to the Privacy Policy and Terms of Admission. <span className="text-red-500">*</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-4 pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1 py-3 text-base"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 py-3 text-base flex items-center justify-center"
                    disabled={creating || !otpVerified || !formData.privacyPolicy}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Enquiry'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
