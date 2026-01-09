'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, FileText, Calendar, Users, TrendingUp, Clock } from 'lucide-react'
import { getDashboardStats } from '@/lib/api'
import { format } from 'date-fns'

interface Stats {
  totalEnquiries: number
  enquiriesToday: number
  enquiriesThisMonth: number
  pendingAdmissions: number
  recentEnquiries: Array<{
    _id: string
    tokenId: string
    childName: string
    grade: string
    createdAt: string
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const result = await getDashboardStats()
      if (result.success && result.data) {
        setStats(result.data)
      }
      setLoading(false)
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      name: 'Total Enquiries',
      value: stats?.totalEnquiries || 0,
      icon: ClipboardList,
      color: 'bg-blue-500',
      href: '/admin/enquiries'
    },
    {
      name: 'Today\'s Enquiries',
      value: stats?.enquiriesToday || 0,
      icon: TrendingUp,
      color: 'bg-green-500',
      href: '/admin/enquiries'
    },
    {
      name: 'This Month',
      value: stats?.enquiriesThisMonth || 0,
      icon: Calendar,
      color: 'bg-purple-500',
      href: '/admin/enquiries'
    },
    {
      name: 'Pending Admissions',
      value: stats?.pendingAdmissions || 0,
      icon: FileText,
      color: 'bg-orange-500',
      href: '/admin/admissions'
    }
  ]

  return (
    <div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <div className="card hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Enquiries */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Enquiries</h2>
            <Link href="/admin/enquiries" className="text-sm text-primary-600 hover:text-primary-700">
              View All
            </Link>
          </div>

          {stats?.recentEnquiries && stats.recentEnquiries.length > 0 ? (
            <div className="space-y-3">
              {stats.recentEnquiries.map((enquiry) => (
                <Link
                  key={enquiry._id}
                  href={`/admin/enquiries/${enquiry._id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{enquiry.childName}</p>
                      <p className="text-sm text-gray-500">{enquiry.grade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-gray-500">{enquiry.tokenId}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(enquiry.createdAt), 'dd MMM, HH:mm')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent enquiries</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/admin/enquiries"
              className="flex items-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <ClipboardList className="h-5 w-5 text-blue-600 mr-3" />
              <span className="font-medium text-blue-900">View All Enquiries</span>
            </Link>

            <Link
              href="/admin/admissions"
              className="flex items-center p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
            >
              <FileText className="h-5 w-5 text-green-600 mr-3" />
              <span className="font-medium text-green-900">Manage Admissions</span>
            </Link>

            <Link
              href="/admin/slots"
              className="flex items-center p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <Calendar className="h-5 w-5 text-purple-600 mr-3" />
              <span className="font-medium text-purple-900">Counselling Slots</span>
            </Link>

            <Link
              href="/admin/settings"
              className="flex items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <Users className="h-5 w-5 text-gray-600 mr-3" />
              <span className="font-medium text-gray-900">Form Templates</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
