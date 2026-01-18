'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  FileText,
  Calendar,
  Users,
  Plus,
  Bell,
  ArrowRight,
  UserPlus,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  BarChart3
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { getEnquiries, getAdmissions, getSlots, getDashboardStats } from '@/lib/api'

interface DashboardStats {
  totalEnquiriesToday: number
  totalAdmissions: number
  admissionsThisMonth: number
  scheduledCounselling: number
}

interface Activity {
  id: string
  type: 'enquiry' | 'admission' | 'slot'
  title: string
  description: string
  time: Date
  status?: string
  priority?: 'high' | 'medium' | 'low'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEnquiriesToday: 0,
    totalAdmissions: 0,
    admissionsThisMonth: 0,
    scheduledCounselling: 0
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [upcomingSlots, setUpcomingSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const todayStr = `${year}-${month}-${day}`

        // Use a 5-minute buffer for "upcoming" meetings within today
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

        // Fetch Stats and Data
        const [statsRes, slotsRes] = await Promise.all([
          getDashboardStats(),
          getSlots({ dateFrom: todayStr, dateTo: todayStr })
        ])

        // 2. Process Activities (Notifications) - FILTER TO TODAY ONLY
        const recentActivities: Activity[] = []
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        if (statsRes.success) {
          const s = statsRes.data
          setStats({
            totalEnquiriesToday: s.enquiriesToday || 0,
            totalAdmissions: s.totalAdmissions || 0,
            admissionsThisMonth: s.admissionsThisMonth || 0,
            scheduledCounselling: s.scheduledCounselling || 0
          })

          // Add Enquiries from today
          if (s.recentEnquiries) {
            s.recentEnquiries.forEach((enq: any) => {
              const date = new Date(enq.createdAt)
              if (date >= startOfToday) {
                recentActivities.push({
                  id: enq._id,
                  type: 'enquiry',
                  title: 'New Enquiry Received',
                  description: `${enq.childName} (${enq.grade})`,
                  time: date,
                  status: enq.status || 'new'
                })
              }
            })
          }

          // Add Admissions from today
          if (s.recentAdmissions) {
            s.recentAdmissions.forEach((adm: any) => {
              const date = new Date(adm.updatedAt || adm.createdAt)
              if (date >= startOfToday) {
                recentActivities.push({
                  id: adm._id,
                  type: 'admission',
                  title: adm.status === 'submitted' ? 'Admission Submitted' : 'Admission Feed',
                  description: `${adm.studentName}`,
                  time: date,
                  status: adm.status
                })
              }
            })
          }
        }

        // 3. Process Upcoming Slots and Flatten Booked Sessions (TODAY ONLY)
        if (slotsRes.success) {
          const allBookings: any[] = []
          slotsRes.data.forEach((slot: any) => {
            // Only include today's slots (extra safety)
            const slotDate = new Date(slot.date)
            const slotDateStr = `${slotDate.getUTCFullYear()}-${String(slotDate.getUTCMonth() + 1).padStart(2, '0')}-${String(slotDate.getUTCDate()).padStart(2, '0')}`

            if (slotDateStr === todayStr && slot.bookings && slot.bookings.length > 0) {
              const [hours, minutes] = slot.endTime.split(':').map(Number)
              const slotEndTime = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), hours, minutes)
              const isPast = slotEndTime < new Date()

              slot.bookings.forEach((booking: any) => {
                if (!isPast) {
                  allBookings.push({
                    id: booking._id,
                    studentName: booking.admissionId?.studentName || 'Unknown Student',
                    time: `${slot.startTime} - ${slot.endTime}`,
                    startTime: slot.startTime,
                    location: 'Virtual Room',
                    admissionId: booking.admissionId?._id
                  })
                }

                // Add to activities feed
                const bookedDate = new Date(booking.bookedAt || slot.date)
                if (bookedDate >= startOfToday) {
                  recentActivities.push({
                    id: booking._id,
                    type: 'slot',
                    title: 'Counselling Slot Booked',
                    description: `${booking.admissionId?.studentName || 'Unknown'} - ${slot.startTime}`,
                    time: bookedDate,
                    status: 'booked'
                  })
                }
              })
            }
          })

          // Sort by time
          allBookings.sort((a, b) => a.startTime.localeCompare(b.startTime))
          setUpcomingSlots(allBookings)
        }

        // Update final sorted activities
        setActivities(recentActivities.sort((a, b) => b.time.getTime() - a.time.getTime()))

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
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
      name: 'ENQUIRIES TODAY',
      value: stats.totalEnquiriesToday,
      icon: ClipboardList,
      color: 'bg-blue-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/admin/enquiries?date=today'
    },
    {
      name: 'ACCEPTED ADMISSIONS',
      value: stats.totalAdmissions,
      icon: Users,
      color: 'bg-emerald-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      href: '/admin/admissions?status=approved'
    },
    {
      name: 'ADMISSIONS THIS MONTH',
      value: stats.admissionsThisMonth,
      icon: FileText,
      color: 'bg-orange-600',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      href: '/admin/admissions'
    },
    {
      name: 'COUNSELLING TODAY',
      value: stats.scheduledCounselling,
      icon: Users,
      color: 'bg-purple-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/admin/slots?date=today'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header with Welcome Message */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500">Welcome back! Here&apos;s what&apos;s happening in your school today.</p>
        </div>
        <div className="hidden sm:flex gap-3">
          <Link href="/admin/enquiries" className="btn-secondary flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Manage Enquiries
          </Link>
          <Link href="/admin/slots" className="btn-primary flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Slots
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Link key={stat.name} href={stat.href} className="group">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group-hover:shadow-md group-hover:border-primary-200 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bgColor} p-2.5 rounded-xl`}>
                  <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                </div>
                <span className="text-xs font-semibold text-gray-400 group-hover:text-primary-600 transition-colors uppercase tracking-wider">
                  Details &rarr;
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">{stat.name}</p>
                <p className="text-3xl font-extrabold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Notifications / Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary-600" />
              Notifications & Recent Activity
            </h2>
            <Link href="/admin/notifications" className="text-sm text-primary-600 hover:underline font-medium">
              View All
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {activities.length === 0 ? (
              <div className="p-12 text-center">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-500">No recent activity found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-4 items-start">
                    <div className={`mt-1 p-2 rounded-full ${activity.type === 'enquiry' ? 'bg-blue-50 text-blue-600' :
                      activity.type === 'admission' ? 'bg-orange-50 text-orange-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                      {activity.type === 'enquiry' ? <UserPlus className="h-4 w-4" /> :
                        activity.type === 'admission' ? <FileText className="h-4 w-4" /> :
                          <Calendar className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{activity.title}</p>
                        <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(activity.time, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{activity.description}</p>
                      {activity.status && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${activity.status === 'new' || activity.status === 'submitted' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                            }`}>
                            {activity.status}
                          </span>
                        </div>
                      )}
                    </div>
                    <Link
                      href={activity.type === 'enquiry' ? `/admin/enquiries/${activity.id}` : `/admin/admissions/${activity.id}`}
                      className="mt-2 p-1 text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-gray-50 p-3 text-center border-t border-gray-50">
              <button className="text-xs font-bold text-gray-500 hover:text-primary-600 transition-colors">
                REFRESH FEED
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Upcoming Counselling / Funnel */}
        <div className="space-y-6">


          {/* Upcoming Counselling */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 px-2">
              <Users className="h-5 w-5 text-purple-600" />
              Upcoming Counselling
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              {upcomingSlots.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400 italic">No counselling sessions today.</p>
                  <Link href="/admin/slots" className="mt-4 text-xs font-bold text-primary-600 hover:underline inline-block">
                    OPEN CALENDAR
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingSlots.map((booking: any) => (
                    <div key={booking.id} className="group relative pl-4 border-l-2 border-purple-200 hover:border-purple-400 transition-all">
                      <div className="absolute left-[-2px] top-0 bottom-0 w-0.5 bg-purple-600 group-hover:w-1 transition-all"></div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900 group-hover:text-purple-700 transition-colors">{booking.studentName}</p>
                        <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 uppercase tracking-tighter">
                          {booking.time.split(' - ')[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-purple-400" />
                          {booking.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-purple-400" />
                          {booking.location}
                        </span>
                      </div>
                      <Link
                        href={`/admin/admissions/${booking.admissionId}`}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-black text-purple-600/60 hover:text-purple-600 transition-all uppercase tracking-widest"
                      >
                        VIEW ADMISSION
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  ))}
                  <Link href="/admin/slots" className="btn-secondary w-full py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700 border-none transition-all shadow-sm hover:shadow-md rounded-xl">
                    Full Schedule
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
