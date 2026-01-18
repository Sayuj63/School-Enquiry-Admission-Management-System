'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { getAdmissions, getCurrentUser } from '@/lib/api'
import { format } from 'date-fns'

interface Admission {
  _id: string
  tokenId: string
  studentName: string
  parentName: string
  grade: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  slotBookingId?: string
  createdAt: string
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
}

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Accepted',
  rejected: 'Rejected'
}

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [user, setUser] = useState<any>(null)

  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')
  const initialStatusFilter = statusParam && ['draft', 'submitted', 'approved', 'rejected'].includes(statusParam) ? statusParam : ''

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [counsellingFilter, setCounsellingFilter] = useState('')

  useEffect(() => {
    fetchAdmissions()
    const checkUser = async () => {
      const res = await getCurrentUser()
      if (res.success) setUser(res.data)
    }
    checkUser()
  }, [page, statusFilter, counsellingFilter])

  const fetchAdmissions = async () => {
    setLoading(true)
    const result = await getAdmissions({
      page,
      limit: 10,
      status: statusFilter || undefined,
      counselling: (counsellingFilter as any) || undefined,
      search: search || undefined
    })

    if (result.success && result.data) {
      setAdmissions(result.data.admissions)
      setTotalPages(result.data.totalPages)
      setTotal(result.data.total)
    }
    setLoading(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchAdmissions()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admissions</h2>
          <p className="text-gray-600">{total} total admissions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            setStatusFilter('')
            setPage(1)
          }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${statusFilter === ''
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
          {user?.role === 'principal' ? 'All Admissions' : 'All Admissions'}
        </button>
        {user?.role === 'principal' && (
          <button
            onClick={() => {
              setStatusFilter('submitted')
              setPage(1)
            }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${statusFilter === 'submitted'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Principal Review
          </button>
        )}
        <button
          onClick={() => {
            setStatusFilter('approved')
            setPage(1)
          }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${statusFilter === 'approved'
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
          Accepted
        </button>
        <button
          onClick={() => {
            setStatusFilter('rejected')
            setPage(1)
          }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${statusFilter === 'rejected'
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
          Rejected
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                placeholder="Search by token ID or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>
          <select
            className="input w-44"
            value={counsellingFilter}
            onChange={(e) => {
              setCounsellingFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Counselling</option>
            <option value="booked">In booked</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : admissions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No admissions found
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
                    Counselling
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admissions.map((admission) => (
                  <tr key={admission._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/admin/admissions/${admission._id}`}
                        className="font-mono text-sm text-primary-600 hover:text-primary-900 font-bold hover:underline"
                      >
                        {admission.tokenId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{admission.studentName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {admission.parentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {admission.grade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {admission.slotBookingId ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          In booked
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(admission.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/admissions/${admission._id}`}
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
    </div >
  )
}
