'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, FileText, Calendar, Users, Plus } from 'lucide-react'
import { format } from 'date-fns'

interface DashboardStats {
  totalEnquiriesToday: number
  totalEnquiriesMonth: number
  pendingAdmissions: number
  scheduledCounselling: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEnquiriesToday: 0,
    totalEnquiriesMonth: 0,
    pendingAdmissions: 0,
    scheduledCounselling: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        const firstDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')

        // Fetch total enquiries today
        const todayResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}/api/enquiries?date=today`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        const todayData = await todayResponse.json()
        const totalEnquiriesToday = todayData.success ? (todayData.data?.enquiries?.length || 0) : 0

        // Fetch total enquiries this month
        const monthResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}/api/enquiries?date=month`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        const monthData = await monthResponse.json()
        const totalEnquiriesMonth = monthData.success ? (monthData.data?.enquiries?.length || 0) : 0

        // Fetch pending admissions (status=draft)
        const admissionsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}/api/admissions?status=draft`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        const admissionsData = await admissionsResponse.json()
        const pendingAdmissions = admissionsData.success ? (admissionsData.data?.admissions?.length || 0) : 0

        // Fetch scheduled counselling (slots with bookings today)
        const slotsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}/api/slots?dateFrom=${today}&dateTo=${today}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        const slotsData = await slotsResponse.json()
        const scheduledCounselling = slotsData.success
          ? (slotsData.data?.reduce((acc: number, slot: any) => acc + (slot.bookedCount || 0), 0) || 0)
          : 0

        setStats({
          totalEnquiriesToday,
          totalEnquiriesMonth,
          pendingAdmissions,
          scheduledCounselling
        })
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
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
      name: 'TOTAL ENQUIRIES TODAY',
      value: stats.totalEnquiriesToday,
      icon: ClipboardList,
      color: 'bg-blue-500',
      href: '/admin/enquiries'
    },
    {
      name: 'TOTAL ENQUIRIES MONTH',
      value: stats.totalEnquiriesMonth,
      icon: Calendar,
      color: 'bg-green-500',
      href: '/admin/enquiries'
    },
    {
      name: 'PENDING ADMISSIONS',
      value: stats.pendingAdmissions,
      icon: FileText,
      color: 'bg-orange-500',
      href: '/admin/admissions'
    },
    {
      name: 'SCHEDULED COUNSELLING',
      value: stats.scheduledCounselling,
      icon: Users,
      color: 'bg-purple-500',
      href: '/admin/slots'
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
                  <p className="text-sm text-gray-500 font-medium">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Link href="/admin/enquiries" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Enquiry
        </Link>
        <Link href="/admin/slots" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Slot
        </Link>
      </div>
    </div>
  )
}
