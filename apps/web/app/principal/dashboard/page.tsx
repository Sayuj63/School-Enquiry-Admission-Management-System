'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Users, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { api, updateAdmission, getSlots, getAdmissions } from '@/lib/api'

interface DashboardStats {
    sessionsToday: number
    approvedCount: number
    rejectedCount: number
}

export default function PrincipalDashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        sessionsToday: 0,
        approvedCount: 0,
        rejectedCount: 0
    })
    const [sessions, setSessions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd')

            // Fetch sessions today using centralized api client
            const todayResponse = await getSlots({ dateFrom: today, dateTo: today })

            // Extract individual bookings for the list
            const todayBookings = todayResponse.success
                ? todayResponse.data?.flatMap((slot: any) =>
                    (slot.bookings || []).map((b: any) => ({
                        ...b,
                        time: `${slot.startTime} - ${slot.endTime}`,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        date: slot.date,
                        slotId: slot._id
                    }))
                ) || []
                : []

            setSessions(todayBookings)
            const sessionsToday = todayBookings.length

            // Fetch Approved and Rejected counts
            const [approvedRes, rejectedRes] = await Promise.all([
                getAdmissions({ status: 'approved', limit: 1 }),
                getAdmissions({ status: 'rejected', limit: 1 })
            ])

            setStats({
                sessionsToday,
                approvedCount: approvedRes.success ? approvedRes.data?.total || 0 : 0,
                rejectedCount: rejectedRes.success ? rejectedRes.data?.total || 0 : 0
            })
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [])

    const handleAction = async (admissionId: string, status: 'approved' | 'rejected') => {
        if (!window.confirm(`Are you sure you want to ${status.toUpperCase()} this application?`)) return;

        try {
            const res = await updateAdmission(admissionId, { status });

            if (res.success) {
                // Refresh data
                fetchStats();
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    const statCards = [
        {
            name: 'SESSIONS TODAY',
            value: stats.sessionsToday,
            icon: Calendar,
            color: 'bg-purple-500',
            href: '/principal/calendar?date=today'
        },
        {
            name: 'APPROVED',
            value: stats.approvedCount,
            icon: Users,
            color: 'bg-emerald-500',
            href: '/principal/admissions?status=approved'
        },
        {
            name: 'REJECTED',
            value: stats.rejectedCount,
            icon: Users,
            color: 'bg-red-500',
            href: '/principal/admissions?status=rejected'
        }
    ]

    return (
        <div className="space-y-8">
            {/* Welcome Message */}
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Principal Dashboard</h1>
                <p className="text-gray-500 mt-2 text-lg">Manage your daily counselling sessions and application decisions.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {statCards.map((stat) => (
                    <Link key={stat.name} href={stat.href}>
                        <div className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
                            <div className="flex items-center relative z-10">
                                <div className={`${stat.color} p-4 rounded-xl shadow-lg shadow-${stat.color.split('-')[1]}-200`}>
                                    <stat.icon className="h-6 w-6 text-white" />
                                </div>
                                <div className="ml-5">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.name}</p>
                                    <p className="text-3xl font-black text-gray-900 mt-1">{stat.value}</p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <stat.icon className="h-24 w-24 -mr-8 -mt-8" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Today's Schedule List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Today's Schedule</h2>
                        <p className="text-sm text-gray-500 mt-1">Directly approve or reject applications after meetings.</p>
                    </div>
                    <span className="px-4 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider">
                        {format(new Date(), 'EEEE, MMM do')}
                    </span>
                </div>

                <div className="divide-y divide-gray-50">
                    {sessions.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium">No sessions scheduled for today.</p>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div key={session._id} className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-start gap-5">
                                    <div className="bg-gray-100 h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-gray-500 text-lg">
                                        {session.admissionId?.studentName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{session.admissionId?.studentName}</h3>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                            <span className="flex items-center text-sm text-gray-500">
                                                <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                                                {session.time}
                                            </span>
                                            <span className="flex items-center text-sm text-gray-500">
                                                <Users className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                                                Grade {session.admissionId?.grade || 'N/A'}
                                            </span>
                                            <Link
                                                href={`/principal/admissions/${session.admissionId?._id}`}
                                                className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors font-bold"
                                            >
                                                {session.tokenId}
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {session.admissionId?.status === 'submitted' ? (
                                        (() => {
                                            const [year, month, day] = session.date.split('T')[0].split('-').map(Number)
                                            const [hours, minutes] = session.startTime.split(':').map(Number)
                                            const startTime = new Date(year, month - 1, day, hours, minutes)
                                            const isTimePassed = new Date() >= startTime

                                            if (!isTimePassed) {
                                                return (
                                                    <span className="text-xs font-medium text-gray-400 border border-gray-100 px-3 py-1.5 rounded-lg flex items-center bg-gray-50/50">
                                                        <Clock className="h-3 w-3 mr-1.5 animate-pulse" />
                                                        Meeting Pending
                                                    </span>
                                                )
                                            }

                                            return (
                                                <>
                                                    <button
                                                        onClick={() => handleAction(session.admissionId?._id, 'rejected')}
                                                        className="px-6 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-bold text-sm transition-all active:scale-95"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(session.admissionId?._id, 'approved')}
                                                        className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 font-bold text-sm transition-all active:scale-95"
                                                    >
                                                        Approve
                                                    </button>
                                                </>
                                            )
                                        })()
                                    ) : (
                                        <span className={`px-4 py-2 rounded-xl text-sm font-bold capitalize flex items-center gap-2 ${session.admissionId?.status === 'approved'
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-red-50 text-red-700'
                                            }`}>
                                            <div className={`h-2 w-2 rounded-full ${session.admissionId?.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                                                }`} />
                                            {session.admissionId?.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex justify-center">
                <Link href="/principal/calendar" className="text-primary-600 hover:text-primary-700 font-bold text-sm flex items-center gap-2 group underline-offset-4 hover:underline">
                    View all scheduled sessions in calendar
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
            </div>
        </div>
    )
}
