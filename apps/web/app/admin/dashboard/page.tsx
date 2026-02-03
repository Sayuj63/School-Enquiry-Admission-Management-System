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
  BarChart3,
  Settings
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { getEnquiries, getAdmissions, getSlots, getDashboardStats } from '@/lib/api'

interface DashboardStats {
  totalEnquiriesToday: number
  totalAdmissions: number
  admissionsThisMonth: number
  scheduledCounselling: number
  waitlistedCount: number
}

interface Activity {
  id: string
  type: 'enquiry' | 'admission' | 'slot' | 'system' | 'reminder'
  title: string
  description: string
  time: Date
  status?: string
  priority?: 'high' | 'medium' | 'low'
  tokenId?: string
  targetId?: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEnquiriesToday: 0,
    totalAdmissions: 0,
    admissionsThisMonth: 0,
    scheduledCounselling: 0,
    waitlistedCount: 0
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

        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

        // Fetch Stats and Data
        const [statsRes, slotsRes] = await Promise.all([
          getDashboardStats(),
          getSlots({ dateFrom: todayStr, dateTo: tomorrowStr })
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
            scheduledCounselling: s.scheduledCounselling || 0,
            waitlistedCount: s.waitlistedCount || 0
          })

          // Use server-side activity feed
          if (s.recentActivities) {
            recentActivities.push(...s.recentActivities.map((act: any) => ({
              id: act.id || act._id,
              type: act.type,
              title: act.action ? act.action.replace(/_/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase()) : act.title,
              description: act.description,
              time: new Date(act.createdAt || act.time),
              status: act.metadata?.newStatus || act.status,
              tokenId: act.tokenId,
              targetId: act.refId
            })))
          }
        }

        // 3. Process Upcoming Slots (remain same for logic)
        if (slotsRes.success) {
          const allBookings: any[] = []
          slotsRes.data.forEach((slot: any) => {
            const slotDate = new Date(slot.date)
            const slotDateStr = slot.date.split('T')[0];

            if (slot.bookings && slot.bookings.length > 0) {
              const [hours, minutes] = slot.endTime.split(':').map(Number)
              const slotEndTime = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), hours, minutes)
              const isPast = slotEndTime < new Date()

              slot.bookings.forEach((booking: any) => {
                if (!isPast || slotDateStr === todayStr) {
                  allBookings.push({
                    id: booking._id,
                    studentName: booking.admissionId?.studentName || 'Unknown Student',
                    time: `${slot.startTime} - ${slot.endTime}`,
                    startTime: slot.startTime,
                    date: slotDateStr,
                    isToday: slotDateStr === todayStr,
                    isPast: isPast,
                    admissionId: booking.admissionId?._id,
                    location: slot.location || 'School Campus'
                  })
                }
              })
            }
          })

          allBookings.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
          })
          setUpcomingSlots(allBookings)
        }

        // Update final sorted activities from server
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
      grad: 'grad-indigo',
      href: '/admin/enquiries?date=today'
    },
    {
      name: 'CONFIRMED ADMISSIONS',
      value: stats.totalAdmissions,
      icon: CheckCircle2,
      color: 'bg-emerald-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      grad: 'grad-emerald',
      href: '/admin/admissions?status=confirmed'
    },
    {
      name: 'ADMISSIONS THIS MONTH',
      value: stats.admissionsThisMonth,
      icon: FileText,
      color: 'bg-orange-600',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      grad: 'grad-orange',
      href: '/admin/admissions'
    },
    {
      name: 'COUNSELLING TODAY',
      value: stats.scheduledCounselling,
      icon: Calendar,
      color: 'bg-purple-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      grad: 'grad-purple',
      href: '/admin/slots?date=today'
    },
    {
      name: 'WAITLISTED',
      value: stats.waitlistedCount,
      icon: Clock,
      color: 'bg-amber-600',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      grad: 'grad-orange',
      href: '/admin/admissions?status=waitlisted'
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((stat) => (
          <Link key={stat.name} href={stat.href} className="group">
            <div className={`p-6 rounded-2xl shadow-lg border-none hover:shadow-xl transition-all h-full ${stat.grad}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-[10px] font-black text-white/70 group-hover:text-white transition-colors uppercase tracking-widest">
                  View List &rarr;
                </span>
              </div>
              <div>
                <p className="text-xs text-white/80 font-bold uppercase tracking-widest mb-1">{stat.name}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black">{stat.value}</p>
                  {stat.name.includes('TODAY') && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/20 rounded">LIVE</span>}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Management Flow Quick Links */}
      <div className="card border-none shadow-md overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100 rounded-full blur-3xl opacity-30 -mr-32 -mt-32 transition-all group-hover:bg-primary-200"></div>
        <div className="relative z-10">
          <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            Management Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/slots" className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-primary-50 hover:shadow-sm border border-transparent hover:border-primary-100 transition-all group/flow">
              <div className="bg-white p-3 rounded-lg shadow-sm group-hover/flow:scale-110 transition-transform">
                <Calendar className="h-5 w-5 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">Set Availability</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Auto-create 30m slots</p>
              </div>
            </Link>
            <Link href="/admin/admissions" className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all group/flow">
              <div className="bg-white p-3 rounded-lg shadow-sm group-hover/flow:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">Manage List</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">View & Sort Applications</p>
              </div>
            </Link>
            <Link href="/admin/admissions" className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 hover:shadow-sm border border-transparent hover:border-emerald-100 transition-all group/flow">
              <div className="bg-white p-3 rounded-lg shadow-sm group-hover/flow:scale-110 transition-transform">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">Review & Approve</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Decision Management</p>
              </div>
            </Link>
            <Link href="/admin/settings?tab=slots" className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-purple-50 hover:shadow-sm border border-transparent hover:border-purple-100 transition-all group/flow">
              <div className="bg-white p-3 rounded-lg shadow-sm group-hover/flow:scale-110 transition-transform">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">Configure Rules</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Durations & Gap logic</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Notifications / Activity Feed */}
        <div className="space-y-4">
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
                        activity.type === 'reminder' ? 'bg-red-50 text-red-600' :
                          'bg-purple-50 text-purple-600'
                      }`}>
                      {activity.type === 'enquiry' ? <UserPlus className="h-4 w-4" /> :
                        activity.type === 'admission' ? <FileText className="h-4 w-4" /> :
                          activity.type === 'reminder' ? <Bell className="h-4 w-4" /> :
                            <Calendar className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">{activity.title}</p>
                          {activity.tokenId && (
                            <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{activity.tokenId}</span>
                          )}
                        </div>
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
                      href={activity.type === 'admission' ? `/admin/admissions/${activity.targetId}` : `/admin/enquiries/${activity.targetId}`}
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
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-purple-700 transition-colors">{booking.studentName}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                            {booking.isToday ? 'Today' : format(new Date(booking.date), 'EEE, MMM d')}
                          </p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-tighter ${booking.isPast ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          'bg-purple-50 text-purple-600 border-purple-100'
                          }`}>
                          {booking.isPast ? '✓ Completed' : booking.time.split(' - ')[0]}
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
