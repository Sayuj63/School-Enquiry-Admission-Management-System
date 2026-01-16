'use client'

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, startOfISOWeek, endOfISOWeek, getWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import { Calendar as CalendarIcon, Clock, MapPin, User, ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { updateAdmission } from '@/lib/api'

const locales = {
    'en-US': enUS,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})

interface Booking {
    _id: string
    tokenId: string
    admissionId: {
        _id?: string
        studentName: string
        parentName: string
        mobile?: string
        grade?: string
        status?: string
    }
}

interface Slot {
    _id: string
    date: string
    startTime: string
    endTime: string
    capacity: number
    bookedCount: number
    status: string
    bookings?: Booking[]
}

type FilterType = 'today' | 'week' | 'all'

interface SlotCalendarProps {
    slots: Slot[]
    type?: 'bookings' | 'available'
    onSelectSlot?: (slot: Slot) => void
    showStats?: boolean
    showFilters?: boolean
    view?: 'month' | 'week' | 'day'
    height?: string | number
}

export default function SlotCalendar({
    slots,
    type = 'bookings',
    onSelectSlot,
    showStats = false,
    showFilters = true,
    view: initialView = 'month',
    height = 800
}: SlotCalendarProps) {
    const [filter, setFilter] = useState<FilterType>('all')
    const [selectedEvent, setSelectedEvent] = useState<any>(null)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>(initialView)

    // Navigation handlers
    const handleNavigate = (action: 'TODAY' | 'PREV' | 'NEXT') => {
        const newDate = new Date(currentDate)

        if (action === 'TODAY') {
            setCurrentDate(new Date())
        } else if (action === 'PREV') {
            if (currentView === 'month') {
                newDate.setMonth(newDate.getMonth() - 1)
            } else if (currentView === 'week') {
                newDate.setDate(newDate.getDate() - 7)
            } else if (currentView === 'day') {
                newDate.setDate(newDate.getDate() - 1)
            }
            setCurrentDate(newDate)
        } else if (action === 'NEXT') {
            if (currentView === 'month') {
                newDate.setMonth(newDate.getMonth() + 1)
            } else if (currentView === 'week') {
                newDate.setDate(newDate.getDate() + 7)
            } else if (currentView === 'day') {
                newDate.setDate(newDate.getDate() + 1)
            }
            setCurrentDate(newDate)
        }
    }

    // Convert slots to calendar events
    const events = slots.flatMap((slot): any[] => {
        const slotDateObj = new Date(slot.date)
        const year = slotDateObj.getUTCFullYear()
        const month = String(slotDateObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(slotDateObj.getUTCDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`

        const start = new Date(`${dateStr}T${slot.startTime}:00`)
        const end = new Date(`${dateStr}T${slot.endTime}:00`)

        if (type === 'available') {
            const slotsLeft = slot.capacity - slot.bookedCount
            return [{
                title: `${slotsLeft}/${slot.capacity} available`,
                start,
                end,
                resource: slot,
                isAvailable: true,
                colorType: slotsLeft === 0 ? 'red' : slotsLeft <= 1 ? 'yellow' : 'green'
            }]
        }

        if (!slot.bookings || slot.bookings.length === 0) return []

        return slot.bookings.map((booking) => {
            const status = booking.admissionId?.status || 'submitted'
            let colorType = 'blue'
            if (status === 'approved') colorType = 'green'
            if (status === 'rejected') colorType = 'red'

            return {
                title: booking.admissionId?.studentName || 'Unknown Student',
                start,
                end,
                resource: {
                    slot,
                    booking,
                    studentName: booking.admissionId?.studentName || 'Unknown',
                    tokenId: booking.tokenId,
                    parentName: booking.admissionId?.parentName || 'Unknown',
                    mobile: booking.admissionId?.mobile || 'N/A',
                    grade: booking.admissionId?.grade || 'N/A',
                    status: status,
                    time: `${slot.startTime} - ${slot.endTime}`,
                    location: 'Counselling Room',
                    colorType
                }
            }
        })
    })

    const filteredEvents = events.filter((event) => {
        if (!showFilters) return true
        const now = new Date()
        const eventDate = event.start

        switch (filter) {
            case 'today':
                return eventDate >= startOfDay(now) && eventDate <= endOfDay(now)
            case 'week':
                return eventDate >= startOfISOWeek(now) && eventDate <= endOfISOWeek(now)
            case 'all':
            default:
                return true
        }
    })

    const EventComponent = ({ event }: any) => {
        const colorType = event.colorType || event.resource?.colorType || 'blue'
        const timeStr = event.resource?.slot ? event.resource?.slot.startTime : ''

        return (
            <div className={`event-capsule ${colorType}`}>
                <span className="truncate flex-1">{event.title}</span>
                {timeStr && <span className="opacity-60 text-[10px] whitespace-nowrap">{timeStr}</span>}
            </div>
        )
    }

    return (
        <div className="premium-calendar h-full flex flex-col pt-4">
            {/* Calendar Toolbar - Custom Header Inspired by Design */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-2 gap-4">
                <div className="flex items-center gap-6">
                    {/* Date Badge */}
                    <div className="flex flex-col items-center bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm min-w-[70px]">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(currentDate, 'MMM')}</span>
                        <span className="text-xl font-black text-gray-900 leading-tight">{format(currentDate, 'dd')}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                {format(currentDate, 'MMMM yyyy')}
                            </h2>
                            <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter self-center">
                                Week {getWeek(currentDate)}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm font-medium mt-0.5">
                            {format(currentDate, 'EEE, MMM do')} — View scheduled sessions
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Navigation */}
                    <div className="flex items-center bg-white border border-gray-100 p-1 rounded-xl shadow-sm">
                        <button onClick={() => handleNavigate('PREV')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleNavigate('TODAY')} className="px-4 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                            Today
                        </button>
                        <button onClick={() => handleNavigate('NEXT')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center bg-white border border-gray-100 p-1 rounded-xl shadow-sm overflow-hidden text-gray-500">
                        {[
                            { id: 'month', label: 'Month' },
                            { id: 'week', label: 'Week' },
                            { id: 'day', label: 'Day' }
                        ].map((v) => (
                            <button
                                key={v.id}
                                onClick={() => setCurrentView(v.id as any)}
                                className={`px-4 py-1.5 text-xs font-extrabold transition-all rounded-lg ${currentView === v.id
                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                                    : 'hover:bg-gray-50'
                                    }`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Calendar Grid */}
            <div style={{ height }} className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
                <Calendar
                    localizer={localizer}
                    events={filteredEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    views={['month', 'week', 'day']}
                    view={currentView}
                    date={currentDate}
                    step={30}
                    timeslots={2}
                    scrollToTime={new Date(2026, 0, 1, 8)} // Start at 8 AM
                    onNavigate={(date) => setCurrentDate(date)}
                    onView={() => { }} // Managed internally
                    onSelectEvent={(event) => {
                        if (type === 'available' && onSelectSlot) {
                            onSelectSlot(event.resource)
                        } else {
                            setSelectedEvent(event)
                        }
                    }}
                    components={{
                        event: EventComponent,
                        toolbar: () => null // We use our custom toolbar above
                    }}
                />
            </div>

            {/* Event Detail Modal */}
            {selectedEvent && type === 'bookings' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Session Details</h3>
                                <p className="text-gray-400 font-medium text-sm mt-1">Review student counselling information</p>
                            </div>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                <Plus className="h-6 w-6 rotate-45" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {[
                                { icon: User, label: 'Student Name', value: selectedEvent.resource.studentName },
                                { icon: User, label: 'Parent Name', value: selectedEvent.resource.parentName },
                                { icon: User, label: 'Grade', value: `Grade ${selectedEvent.resource.grade}` },
                                { icon: Clock, label: 'Scheduled Time', value: `${format(selectedEvent.start, 'MMMM d')} at ${selectedEvent.resource.time}` },
                                { icon: CalendarIcon, label: 'Token Identification', value: selectedEvent.resource.tokenId, isMono: true },
                                { icon: MapPin, label: 'Location Room', value: selectedEvent.resource.location }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-4">
                                    <div className="bg-gray-50 p-2.5 rounded-xl">
                                        <item.icon className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{item.label}</p>
                                        <p className={`text-base font-bold text-gray-900 mt-1 ${item.isMono ? 'font-mono bg-gray-50 px-2 py-0.5 rounded' : ''}`}>
                                            {item.value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Principal Action Section */}
                        {(() => {
                            const slot = selectedEvent.resource.slot
                            const admissionStatus = selectedEvent.resource.status
                            const [year, month, day] = slot.date.split('T')[0].split('-').map(Number)
                            const [hours, minutes] = slot.startTime.split(':').map(Number)
                            const startTime = new Date(year, month - 1, day, hours, minutes)
                            const isTimePassed = new Date() >= startTime

                            if (!isTimePassed) return (
                                <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center gap-3">
                                    <Clock className="h-5 w-5 text-gray-400 animate-pulse" />
                                    <span className="text-sm font-bold text-gray-400">Meeting starts soon</span>
                                </div>
                            );

                            if (admissionStatus !== 'submitted') {
                                return (
                                    <div className="mt-8 flex justify-center border-t border-gray-50 pt-8">
                                        <span className={`px-8 py-3 rounded-2xl text-sm font-black capitalize flex items-center gap-3 shadow-lg ${admissionStatus === 'approved'
                                            ? 'bg-green-600 text-white shadow-green-200'
                                            : 'bg-red-600 text-white shadow-red-200'
                                            }`}>
                                            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                            Application {admissionStatus}
                                        </span>
                                    </div>
                                )
                            }

                            return (
                                <div className="mt-8 flex gap-4 border-t border-gray-50 pt-8">
                                    <button
                                        onClick={async () => {
                                            if (window.confirm('Are you sure you want to REJECT this application?')) {
                                                const admissionId = selectedEvent.resource.booking.admissionId._id;
                                                try {
                                                    const res = await updateAdmission(admissionId, { status: 'rejected' });
                                                    if (res.success) {
                                                        alert('Application Rejected');
                                                        setSelectedEvent(null);
                                                        window.location.reload();
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                }
                                            }
                                        }}
                                        className="flex-1 py-4 border-2 border-red-100 text-red-600 rounded-2xl hover:bg-red-50 font-black text-sm transition-all active:scale-95"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm('Are you sure you want to APPROVE this application?')) {
                                                const admissionId = selectedEvent.resource.booking.admissionId._id;
                                                try {
                                                    const res = await updateAdmission(admissionId, { status: 'approved' });
                                                    if (res.success) {
                                                        alert('Application Approved');
                                                        setSelectedEvent(null);
                                                        window.location.reload();
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                }
                                            }
                                        }}
                                        className="flex-1 py-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 shadow-xl shadow-green-200 font-black text-sm transition-all active:scale-95"
                                    >
                                        Approve
                                    </button>
                                </div>
                            )
                        })()}

                        <div className="mt-4">
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="w-full py-4 text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors"
                            >
                                Go back
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
