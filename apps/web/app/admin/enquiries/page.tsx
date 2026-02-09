'use client'

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Plus, X, Loader2, CheckCircle, User, Calendar, Info } from 'lucide-react'
import { getEnquiries, getEnquiryTemplate, adminSubmitEnquiry, sendOTP, verifyOTP, getAvailableSlots, getGradeRules } from '@/lib/api'
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns'

interface Enquiry {
  _id: string
  tokenId: string
  parentName: string
  childName: string
  mobile: string
  email: string
  grade: string
  status: 'new' | 'draft' | 'pending_admission' | 'converted'
  createdAt: string
  slotBooked?: boolean
  bookedCount?: number
  admissionStatus?: 'draft' | 'submitted' | 'approved' | 'rejected' | null
}

const statusColors: any = {
  new: 'bg-blue-100 text-blue-800',
  draft: 'bg-orange-100 text-orange-800',
  pending_admission: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-green-100 text-green-800'
}

const statusLabels = {
  new: 'New',
  draft: 'Draft (Incomplete)',
  pending_admission: 'Pending Admission',
  converted: 'Admission Approved'
}

function EnquiriesContent() {
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
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [gradeRules, setGradeRules] = useState<any[]>([])
  const [gradeSettings, setGradeSettings] = useState<any>(null)

  // Logic for filtered grades based on DoB (Replicating parent form logic)
  const filteredGrades = useMemo(() => {
    // Find DoB field value. Template might use 'dob', 'studentDob', etc.
    const dobValue = formData.dob || formData.studentDob || formData.dateOfBirth || formData.date_of_birth

    if (!dobValue || !gradeRules.length || !gradeSettings) return []

    const birthDate = new Date(dobValue)
    const cutOffRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/
    if (!gradeSettings.cutOffDate || !cutOffRegex.test(gradeSettings.cutOffDate)) {
      return []
    }

    const [month, day] = gradeSettings.cutOffDate.split('-').map(Number)
    const targetYear = 2026 // Target academic year
    const cutOffDate = new Date(targetYear, month - 1, day)

    let age = cutOffDate.getFullYear() - birthDate.getFullYear()
    const m = cutOffDate.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && cutOffDate.getDate() < birthDate.getDate())) {
      age--
    }

    const eligibleRules = gradeRules.filter(r => r.minAge <= age)
    if (eligibleRules.length === 0) return []

    const baseGradeIndex = gradeRules.indexOf(eligibleRules[eligibleRules.length - 1])
    const maxGradeIndex = Math.min(gradeRules.length - 1, baseGradeIndex + (gradeSettings.additionalGradesAllowed || 0))

    return gradeRules.slice(0, maxGradeIndex + 1).map(r => ({
      grade: r.grade,
      isFull: r.isFull
    }))
  }, [formData, gradeRules, gradeSettings])

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

  // Auto-clear alerts after 5 seconds
  useEffect(() => {
    if (modalError || modalSuccess) {
      const timer = setTimeout(() => {
        setModalError('')
        setModalSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [modalError, modalSuccess])

  const fetchEnquiries = async () => {
    setLoading(true)

    let dateFrom = undefined
    if (dateFilter) {
      const now = new Date()
      if (dateFilter === 'today') dateFrom = startOfDay(now).toISOString()
      if (dateFilter === 'week') dateFrom = startOfWeek(now).toISOString()
      if (dateFilter === 'month') dateFrom = startOfMonth(now).toISOString()
    }

    const result = await getEnquiries({
      page,
      limit: 10,
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      grade: classFilter || undefined,
      dateFrom
    })

    if (result.success && result.data) {
      setEnquiries(result.data.enquiries)
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
    setSelectedSlotId('')

    const [templateRes, slotsRes, gradeRes] = await Promise.all([
      getEnquiryTemplate(),
      getAvailableSlots(),
      getGradeRules()
    ])

    if (templateRes.success && templateRes.data) {
      setTemplateFields(templateRes.data.fields || [])
    }
    if (slotsRes.success && slotsRes.data) {
      setAvailableSlots(slotsRes.data)
    }
    if (gradeRes.success && gradeRes.data) {
      setGradeRules(gradeRes.data.rules || [])
      setGradeSettings(gradeRes.data.settings || null)
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

    const isWaitlisted = filteredGrades.find(r => r.grade === formData.grade)?.isFull || false

    const payload = {
      ...formData,
      // Map names if needed (backend expects childName, template might use studentName or childName)
      childName: formData.childName || formData.studentName || formData.child_name || formData.student_name,
      dob: formData.dob || formData.studentDob || formData.dateOfBirth || formData.date_of_birth,
      slotId: isWaitlisted ? undefined : selectedSlotId,
      waitlist: isWaitlisted
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
              <option value="draft">Incomplete (Draft)</option>
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
                      ) : enquiry.status === 'draft' ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.draft}`}>
                          {statusLabels.draft}
                        </span>
                      ) : (enquiry as any).status === 'in_progress' || enquiry.status === 'pending_admission' ? (
                        enquiry.admissionStatus === 'draft' ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors.draft}`}>
                            {statusLabels.draft}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-[32px] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Plus className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-none">Manual Enquiry Entry</h3>
                  <p className="text-sm text-gray-500 mt-1">Fill this form on behalf of the parent</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-xl transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <form onSubmit={handleCreateEnquiry} className="space-y-8">
                {modalError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {modalError}
                  </div>
                )}

                {modalSuccess && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-sm text-green-600 font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle className="h-5 w-5" />
                    {modalSuccess}
                  </div>
                )}

                <div className="card p-8 bg-white border-none shadow-sm shadow-gray-200/50">
                  <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary-600" />
                    Student & Parent Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {templateFields.map((field) => (
                      <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                        {field.type !== 'checkbox' && (
                          <label className="label text-sm font-bold text-gray-700 mb-1.5 block">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                        )}

                        {field.name === 'mobile' ? (
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="relative flex-1 group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 font-medium">
                                  <span className="text-sm border-r border-gray-200 pr-2 group-focus-within:border-primary-200">+91</span>
                                </div>
                                <input
                                  type="tel"
                                  className="input pl-14 w-full h-12 text-base font-medium"
                                  placeholder="00000 00000"
                                  value={formData.mobile || ''}
                                  onChange={(e) => handleInputChange(field, e.target.value.replace(/\D/g, ''))}
                                  disabled={otpVerified}
                                  required={field.required}
                                />
                              </div>
                              {otpVerified ? (
                                <div className="flex items-center gap-2 text-emerald-600 px-5 py-2 font-bold bg-emerald-50 rounded-xl border border-emerald-100 h-12">
                                  <CheckCircle className="h-5 w-5" /> Verified
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary h-12 px-6 rounded-xl font-bold uppercase tracking-wider text-[10px] whitespace-nowrap bg-gray-50 border-gray-200 hover:bg-white hover:border-primary-600 hover:text-primary-600 transition-all active:scale-95"
                                  onClick={handleSendOTP}
                                  disabled={!formData.mobile || sendingOtp}
                                >
                                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : (otpSent ? 'Resend code' : 'Send Code')}
                                </button>
                              )}
                            </div>

                            {otpSent && !otpVerified && (
                              <div className="space-y-4 p-5 bg-primary-50 rounded-2xl border border-primary-100 animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center">
                                  <p className="text-xs text-primary-800 font-bold uppercase tracking-widest">Verification Sent</p>
                                  {devOtp && (
                                    <div className="bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-primary-100">
                                      <p className="text-[10px] text-primary-600 font-mono">DEV: <span className="font-bold">{devOtp}</span></p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-3">
                                  <input
                                    type="text"
                                    className="input flex-1 bg-white h-12 text-center text-xl font-black tracking-[0.4em] placeholder:tracking-normal placeholder:text-gray-300"
                                    placeholder="••••••"
                                    maxLength={6}
                                    value={otpValue}
                                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                  />
                                  <button
                                    type="button"
                                    className="btn-primary h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary-200 transition-all active:scale-95"
                                    onClick={handleVerifyOTP}
                                    disabled={otpValue.length !== 6 || verifyingOtp}
                                  >
                                    {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : 'Verify'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            className="input min-h-[100px] resize-none py-3"
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field, e.target.value)}
                            required={field.required}
                          />
                        ) : field.name === 'grade' ? (
                          <div className="flex flex-col">
                            <select
                              className="input h-12 font-medium"
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field, e.target.value)}
                              required={field.required}
                            >
                              <option value="">Select Grade</option>
                              {(formData.dob || formData.studentDob || formData.dateOfBirth || formData.date_of_birth ? filteredGrades : gradeRules.map(r => ({ grade: r.grade, isFull: r.isFull }))).map(opt => (
                                <option key={opt.grade} value={opt.grade}>
                                  {opt.grade} {opt.isFull ? '(Waitlist Only)' : ''}
                                </option>
                              ))}
                            </select>
                            {!(formData.dob || formData.studentDob || formData.dateOfBirth || formData.date_of_birth) && (
                              <p className="text-[10px] text-gray-400 mt-1 flex items-center">
                                <Info className="h-3 w-3 mr-1" /> Select DoB first to see eligible grades.
                              </p>
                            )}
                          </div>
                        ) : field.type === 'select' ? (
                          <select
                            className="input h-12 font-medium"
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
                          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100/50 transition-colors group cursor-pointer" onClick={() => handleInputChange(field, !formData[field.name])}>
                            <input
                              id={field.name}
                              type="checkbox"
                              className="h-5 w-5 rounded-lg border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                              checked={!!formData[field.name]}
                              onChange={() => { }} // Handled by div click
                            />
                            <label htmlFor={field.name} className="flex-1 font-bold text-gray-700 text-sm cursor-pointer select-none">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                          </div>
                        ) : (
                          <input
                            type={field.type}
                            className="input h-12 font-medium"
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field, e.target.value)}
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-8 bg-white border-none shadow-sm shadow-gray-200/50">
                  <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary-600" />
                    Counselling Slot
                  </h4>
                  {filteredGrades.find(r => r.grade === formData.grade)?.isFull ? (
                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl">
                      <div className="flex items-center gap-3 text-amber-900 font-bold mb-2">
                        <Info className="h-5 w-5 text-amber-600" />
                        Waitlist Admission
                      </div>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        Admissions for <strong>{formData.grade}</strong> are currently full. This enquiry will be moved to the waitlist.
                        Counselling slots are not required for waitlisted applications.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mb-6">Select a slot for the parent's visit</p>

                      {availableSlots.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {availableSlots.map(slot => (
                            <button
                              key={slot._id}
                              type="button"
                              onClick={() => setSelectedSlotId(slot._id)}
                              className={`p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] ${selectedSlotId === slot._id
                                ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100'
                                : 'border-gray-100 bg-white hover:border-primary-200'
                                }`}
                            >
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                                  {format(new Date(slot.date), 'EEE')}
                                </p>
                                <p className="font-black text-gray-900 leading-none">
                                  {format(new Date(slot.date), 'dd MMM')}
                                </p>
                                <p className="text-sm text-primary-700 font-bold mt-2 bg-white/50 py-1 px-2 rounded-lg border border-primary-100 text-center">
                                  {slot.startTime}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <p className="text-gray-500 font-medium text-sm">No available slots found for the next period.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="card p-8 bg-white border-none shadow-sm shadow-gray-200/50">
                  <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary-600" />
                    Agreement & Confirmation
                  </h4>
                  <p className="text-sm text-gray-500 mb-6">Confirm administrative compliance</p>

                  <div
                    className={`flex items-start gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${formData.privacyPolicy ? 'bg-indigo-50 border-indigo-100 ring-2 ring-indigo-50' : 'bg-gray-50 border-gray-100'}`}
                    onClick={() => setFormData(prev => ({ ...prev, privacyPolicy: !prev.privacyPolicy }))}
                  >
                    <div className="flex items-center h-6 mt-0.5">
                      <input
                        id="privacyPolicy"
                        type="checkbox"
                        className="h-5 w-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={!!formData.privacyPolicy}
                        onChange={() => { }}
                      />
                    </div>
                    <div>
                      <label htmlFor="privacyPolicy" className="font-bold text-gray-800 text-sm cursor-pointer block select-none">
                        Administrative Compliance Confirmation <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        I hereby certify that the parent/guardian has been informed of and has consented to the school's Privacy Policy, Data Processing terms, and Admission Conditions as per regulatory requirements.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-white hover:bg-gray-50 active:scale-[0.98] transition-all"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
                    disabled={creating || !otpVerified || !formData.privacyPolicy}
                  >
                    {creating ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      'Register Enquiry'
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

export default function EnquiriesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    }>
      <EnquiriesContent />
    </Suspense>
  )
}
