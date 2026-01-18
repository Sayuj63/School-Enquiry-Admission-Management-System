'use client'

import { useEffect, useState } from 'react'
import { Bell, UserPlus, FileText, Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { getEnquiries, getAdmissions, getSlots } from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface Activity {
    id: string
    type: 'enquiry' | 'admission' | 'slot'
    title: string
    description: string
    time: Date
    status?: string
}

export default function NotificationsPage() {
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)

    useEffect(() => {
        async function fetchAllActivity() {
            setLoading(true)
            try {
                const [enquiriesRes, admissionsRes, slotsRes] = await Promise.all([
                    getEnquiries({ limit: 50, status: 'all' }),
                    getAdmissions({ limit: 50 }),
                    getSlots({}) // All slots
                ])

                const allActivities: Activity[] = []

                if (enquiriesRes.success) {
                    enquiriesRes.data.enquiries.forEach((enq: any) => {
                        allActivities.push({
                            id: enq._id,
                            type: 'enquiry',
                            title: 'New Enquiry Received',
                            description: `${enq.childName} (${enq.grade})`,
                            time: new Date(enq.createdAt),
                            status: enq.status || 'new'
                        })
                    })
                }

                if (admissionsRes.success) {
                    admissionsRes.data.admissions.forEach((adm: any) => {
                        allActivities.push({
                            id: adm._id,
                            type: 'admission',
                            title: adm.status === 'submitted' ? 'Admission Submitted' : 'Admission Form',
                            description: `${adm.studentName}`,
                            time: new Date(adm.updatedAt || adm.createdAt),
                            status: adm.status
                        })
                    })
                }

                if (slotsRes.success) {
                    slotsRes.data.forEach((slot: any) => {
                        if (slot.bookings) {
                            slot.bookings.forEach((booking: any) => {
                                allActivities.push({
                                    id: booking._id,
                                    type: 'slot',
                                    title: 'Counselling Slot Booked',
                                    description: `${booking.admissionId?.studentName || 'Unknown'} - ${slot.startTime} on ${format(new Date(slot.date), 'dd MMM')}`,
                                    time: new Date(booking.bookedAt || slot.date),
                                    status: 'booked'
                                })
                            })
                        }
                    })
                }

                setActivities(allActivities.sort((a, b) => b.time.getTime() - a.time.getTime()))
            } catch (error) {
                console.error('Error fetching activities:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchAllActivity()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bell className="h-6 w-6 text-primary-600" />
                        All System Notifications
                    </h1>
                    <p className="text-gray-500 text-sm">A complete record of all recent actions and updates.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {activities.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No notifications found.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {activities.map((activity) => (
                            <div key={activity.id} className="p-6 hover:bg-gray-50 transition-colors flex gap-5 items-start">
                                <div className={`p-3 rounded-2xl ${activity.type === 'enquiry' ? 'bg-blue-50 text-blue-600' :
                                        activity.type === 'admission' ? 'bg-orange-50 text-orange-600' :
                                            'bg-purple-50 text-purple-600'
                                    }`}>
                                    {activity.type === 'enquiry' ? <UserPlus className="h-5 w-5" /> :
                                        activity.type === 'admission' ? <FileText className="h-5 w-5" /> :
                                            <Calendar className="h-5 w-5" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-bold text-gray-900">{activity.title}</p>
                                        <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                                            <Clock className="h-3.5 w-3.5" />
                                            {format(activity.time, 'MMM d, yyyy • h:mm a')}
                                            <span className="text-gray-300">({formatDistanceToNow(activity.time, { addSuffix: true })})</span>
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">{activity.description}</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {activity.status && (
                                                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider ${activity.status === 'new' || activity.status === 'submitted' || activity.status === 'booked' ? 'bg-emerald-50 text-emerald-700' :
                                                        'bg-amber-50 text-amber-700'
                                                    }`}>
                                                    {activity.status}
                                                </span>
                                            )}
                                            <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider bg-gray-100 text-gray-500`}>
                                                {activity.type}
                                            </span>
                                        </div>
                                        <Link
                                            href={activity.type === 'enquiry' ? `/admin/enquiries/${activity.id}` : `/admin/admissions/${activity.id}`}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                                        >
                                            VIEW DETAILS
                                            <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
