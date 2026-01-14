'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Users } from 'lucide-react'
import { format } from 'date-fns'

interface DashboardStats {
    sessionsToday: number
    totalScheduled: number
}

export default function PrincipalDashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        sessionsToday: 0,
        totalScheduled: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const today = format(new Date(), 'yyyy-MM-dd')

                // Fetch sessions today
                const todayResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}/api/slots?dateFrom=${today}&dateTo=${today}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                })
                const todayData = await todayResponse.json()
                const sessionsToday = todayData.success
                    ? (todayData.data?.reduce((acc: number, slot: any) => acc + (slot.bookedCount || 0), 0) || 0)
                    : 0

                // Fetch all scheduled sessions (future slots with bookings)
                const allResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}/api/slots?dateFrom=${today}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                })
                const allData = await allResponse.json()
                const totalScheduled = allData.success
                    ? (allData.data?.reduce((acc: number, slot: any) => acc + (slot.bookedCount || 0), 0) || 0)
                    : 0

                setStats({
                    sessionsToday,
                    totalScheduled
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
            name: 'SESSIONS TODAY',
            value: stats.sessionsToday,
            icon: Calendar,
            color: 'bg-purple-500',
            href: '/principal/calendar'
        },
        {
            name: 'TOTAL SCHEDULED',
            value: stats.totalScheduled,
            icon: Users,
            color: 'bg-blue-500',
            href: '/principal/calendar'
        }
    ]

    return (
        <div>
            {/* Welcome Message */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Principal Dashboard</h1>
                <p className="text-gray-600 mt-1">Counselling sessions overview</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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

            {/* Quick Actions */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
                <Link href="/principal/calendar" className="btn-primary inline-flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Calendar
                </Link>
            </div>
        </div>
    )
}
