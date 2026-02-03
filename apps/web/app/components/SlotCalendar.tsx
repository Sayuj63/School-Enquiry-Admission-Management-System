'use client'

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, startOfISOWeek, endOfISOWeek, getWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import { Calendar as CalendarIcon, Clock, MapPin, User, ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { useState, useEffect } from 'react'
import { updateAdmission, getCurrentUser } from '@/lib/api'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { usePathname } from 'next/navigation'

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

// Helper to parse time string like "10:00 AM" or "14:30" into a Date object
const parseTimeToDate = (dateStr: string, timeStr: string) => {
    try {
        // Handle "10:30 AM" format
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);

            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;

            const finalTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
            return new Date(`${dateStr}T${finalTime}`);
        }

        // Handle "14:30" format
        return new Date(`${dateStr}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}`);
    } catch (e) {
        console.error('Error parsing time:', timeStr, e);
        return new Date(`${dateStr}T00:00:00`);
    }
}

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
    status: 'available' | 'full' | 'disabled'
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
    const [selectedGroup, setSelectedGroup] = useState<any[] | null>(null)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>(initialView)
    const [user, setUser] = useState<any>(null)
    const [scrollTime, setScrollTime] = useState(new Date(2026, 0, 1, 8))

    const pathname = usePathname()
    const isPrincipalPortal = pathname?.startsWith('/principal')
    const linkPrefix = isPrincipalPortal ? '/principal/admissions' : '/admin/admissions'

    useEffect(() => {
        if (slots.length > 0 && type === 'available') {
            // Find the first slot date that is today or in the future
            const firstSlot = slots[0]
            const slotDate = new Date(firstSlot.date)
            setCurrentDate(slotDate)

            // Set scroll time to 1 hour before the first slot
            try {
                const [time] = firstSlot.startTime.split(' ')
                let [hours] = time.split(':').map(Number)
                if (firstSlot.startTime.includes('PM') && hours < 12) hours += 12
                if (firstSlot.startTime.includes('AM') && hours === 12) hours = 0

                const scrollDate = new Date(slotDate)
                scrollDate.setHours(Math.max(0, hours - 1), 0, 0)
                setScrollTime(scrollDate)
            } catch (e) {
                console.error('Error setting scroll time:', e)
            }
        }
    }, [slots, type])

    useEffect(() => {
        async function fetchUser() {
            const result = await getCurrentUser()
            if (result.success) {
                setUser(result.data)
            }
        }
        fetchUser()
    }, [])

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
    const events = (() => {
        if (type === 'available') {
            return slots.map((slot): any => {
                const slotDateObj = new Date(slot.date)
                const year = slotDateObj.getUTCFullYear()
                const month = String(slotDateObj.getUTCMonth() + 1).padStart(2, '0')
                const day = String(slotDateObj.getUTCDate()).padStart(2, '0')
                const dateStr = `${year}-${month}-${day}`

                const start = parseTimeToDate(dateStr, slot.startTime)
                const end = parseTimeToDate(dateStr, slot.endTime)

                const slotsLeft = slot.capacity - slot.bookedCount
                let colorType = 'green'
                if (slotsLeft === 0) colorType = 'red'
                else if (slotsLeft === 1) colorType = 'orange'
                else if (slotsLeft === 2) colorType = 'indigo'

                return {
                    title: `${slotsLeft}/${slot.capacity} available`,
                    start,
                    end,
                    resource: slot,
                    isAvailable: true,
                    colorType
                }
            })
        }

        // type === 'bookings'
        // Group all bookings by date
        const grouped: Record<string, any[]> = {}

        slots.forEach(slot => {
            const slotDateObj = new Date(slot.date)
            const year = slotDateObj.getUTCFullYear()
            const month = String(slotDateObj.getUTCMonth() + 1).padStart(2, '0')
            const day = String(slotDateObj.getUTCDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`

            if (!grouped[dateStr]) grouped[dateStr] = []

            if (slot.bookings) {
                slot.bookings.forEach(booking => {
                    const status = booking.admissionId?.status || 'submitted'
                    let colorType = 'blue'
                    if (status === 'approved') colorType = 'green'
                    if (status === 'rejected') colorType = 'red'

                    grouped[dateStr].push({
                        slot,
                        booking,
                        status,
                        colorType,
                        studentName: booking.admissionId?.studentName || 'Unknown',
                        tokenId: booking.tokenId,
                        parentName: booking.admissionId?.parentName || 'Unknown',
                        mobile: booking.admissionId?.mobile || 'N/A',
                        grade: booking.admissionId?.grade || 'N/A',
                        time: `${slot.startTime} - ${slot.endTime}`,
                        location: 'Counselling Room'
                    })
                })
            }
        })

        return Object.entries(grouped)
            .filter(([_, items]) => items.length > 0)
            .map(([dateStr, items]): any => {
                // Find earliest start and latest end to position the group correctly
                const sortedItems = [...items].sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime))
                const earliestItem = sortedItems[0]
                const latestItem = [...items].sort((a, b) => b.slot.endTime.localeCompare(a.slot.endTime))[0]

                const start = parseTimeToDate(dateStr, earliestItem.slot.startTime)
                const end = parseTimeToDate(dateStr, latestItem.slot.endTime)

                return {
                    title: `${items.length} ${items.length === 1 ? 'Meeting' : 'Meetings'} Today`,
                    start,
                    end,
                    resource: {
                        type: 'grouped',
                        items: sortedItems,
                        colorType: 'purple' // Special color for grouped items
                    }
                }
            })
    })()

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

        let timeLabel = ''
        if (event.resource?.type === 'grouped' && event.resource.items.length > 0) {
            const items = event.resource.items
            if (items.length === 1) {
                timeLabel = items[0].time
            } else {
                timeLabel = `${items[0].slot.startTime} - ${items[items.length - 1].slot.endTime}`
            }
        } else if (event.resource?.startTime) {
            timeLabel = event.resource.startTime
        }

        return (
            <div className={`event-capsule ${colorType} h-full`}>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="truncate font-bold text-[11px] leading-tight">{event.title}</span>
                    {timeLabel && <span className="opacity-80 text-[10px] font-medium whitespace-nowrap">{timeLabel}</span>}
                </div>
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
                    dayLayoutAlgorithm="overlap"
                    scrollToTime={scrollTime}
                    onNavigate={(date) => setCurrentDate(date)}
                    onView={() => { }} // Managed internally
                    onSelectEvent={(event) => {
                        if (type === 'available' && onSelectSlot) {
                            onSelectSlot(event.resource)
                        } else if (event.resource?.type === 'grouped') {
                            setSelectedGroup(event.resource.items)
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

            {/* Day Group Modal */}
            {selectedGroup && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] p-8 max-w-lg w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Daily Schedule</h3>
                                <p className="text-gray-400 font-medium text-sm mt-1">
                                    {selectedGroup.length} {selectedGroup.length === 1 ? 'meeting' : 'meetings'}
                                    {selectedGroup[0]?.slot?.date && ` on ${format(new Date(selectedGroup[0].slot.date), 'MMMM d, yyyy')}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedGroup(null)}
                                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                <Plus className="h-6 w-6 rotate-45" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                            {(() => {
                                // Group items by time slot
                                const timeGroups: Record<string, any[]> = {}
                                selectedGroup.forEach(item => {
                                    if (!timeGroups[item.time]) timeGroups[item.time] = []
                                    timeGroups[item.time].push(item)
                                })

                                // Sort time slots and render
                                return Object.entries(timeGroups)
                                    .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
                                    .map(([time, items], groupIdx) => (
                                        <div key={groupIdx} className="space-y-3">
                                            {/* Time Slot Header */}
                                            <div className="flex items-center gap-3 px-1">
                                                <div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-100">
                                                    <Clock className="h-3.5 w-3.5 text-primary-600" />
                                                    <span className="text-xs font-black text-primary-700 tracking-tight">
                                                        {time}
                                                    </span>
                                                </div>
                                                <div className="h-px flex-1 bg-gradient-to-r from-gray-100 to-transparent" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    {items.length} {items.length === 1 ? 'Booking' : 'Bookings'}
                                                </span>
                                            </div>

                                            {/* Students in this slot */}
                                            <div className="grid gap-3">
                                                {items.map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            const slotDateOnly = item.slot.date.split('T')[0]
                                                            setSelectedEvent({
                                                                start: parseTimeToDate(slotDateOnly, item.slot.startTime),
                                                                resource: item,
                                                                previousGroup: selectedGroup // Store the group to return to
                                                            })
                                                            setSelectedGroup(null)
                                                        }}
                                                        className="p-5 border border-gray-100 rounded-[24px] hover:border-primary-200 hover:bg-primary-50/40 transition-all cursor-pointer group bg-white shadow-sm hover:shadow-md"
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${item.colorType === 'green' ? 'bg-green-100/80 text-green-700' :
                                                                    item.colorType === 'red' ? 'bg-red-100/80 text-red-700' :
                                                                        'bg-blue-100/80 text-blue-700'
                                                                    }`}>
                                                                    {item.status}
                                                                </span>
                                                            </div>
                                                            <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                                                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                                                            </div>
                                                        </div>
                                                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-primary-700 transition-colors">{item.studentName}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Link
                                                                href={item.booking.admissionId ? `${linkPrefix}/${item.booking.admissionId._id || item.booking.admissionId}` : '#'}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-sm text-primary-600 font-mono font-bold hover:underline"
                                                            >
                                                                {item.tokenId}
                                                            </Link>
                                                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                                                            <p className="text-sm text-gray-500 font-medium">Grade {item.grade}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                            })()}
                        </div>

                        <button
                            onClick={() => setSelectedGroup(null)}
                            className="mt-6 w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-gray-800 transition-all active:scale-95 shadow-xl shadow-gray-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && type === 'bookings' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-200">
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
                                {
                                    icon: CalendarIcon,
                                    label: 'Token Identification',
                                    value: (
                                        <Link
                                            href={selectedEvent.resource.booking.admissionId ? `${linkPrefix}/${selectedEvent.resource.booking.admissionId._id || selectedEvent.resource.booking.admissionId}` : '#'}
                                            className="text-primary-600 hover:underline"
                                        >
                                            {selectedEvent.resource.tokenId}
                                        </Link>
                                    ),
                                    isMono: true
                                },
                                { icon: MapPin, label: 'Location Room', value: selectedEvent.resource.location }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-4">
                                    <div className="bg-gray-50 p-2.5 rounded-xl">
                                        <item.icon className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{item.label}</p>
                                        <div className={`text-base font-bold text-gray-900 mt-1 ${item.isMono ? 'font-mono bg-gray-50 px-2 py-0.5 rounded w-fit' : ''}`}>
                                            {item.value}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Action Section */}
                        {(() => {
                            const slot = selectedEvent.resource.slot
                            const admissionStatus = selectedEvent.resource.status
                            const [year, month, day] = slot.date.split('T')[0].split('-').map(Number)
                            const [hours, minutes] = slot.startTime.split(':').map(Number)
                            const startTime = new Date(year, month - 1, day, hours, minutes)
                            const isTimePassed = new Date() >= startTime

                            if (!isTimePassed) {
                                return (
                                    <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center gap-3">
                                        <Clock className="h-5 w-5 text-gray-400 animate-pulse" />
                                        <span className="text-sm font-bold text-gray-400">Meeting starts soon</span>
                                    </div>
                                )
                            }

                            if (admissionStatus !== 'submitted' && admissionStatus !== 'new') {
                                return (
                                    <div className="mt-8 flex justify-center border-t border-gray-50 pt-8">
                                        <span className={`px-8 py-3 rounded-2xl text-sm font-black capitalize flex items-center gap-3 shadow-lg ${admissionStatus === 'approved'
                                            ? 'bg-green-600 text-white shadow-green-200'
                                            : admissionStatus === 'rejected'
                                                ? 'bg-red-600 text-white shadow-red-200'
                                                : 'bg-blue-600 text-white shadow-blue-200'
                                            }`}>
                                            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                            {admissionStatus === 'submitted' ? 'Application Submitted' : `Application ${admissionStatus}`}
                                        </span>
                                    </div>
                                )
                            }

                            return (
                                <div className="mt-8 flex gap-4 border-t border-gray-50 pt-8">
                                    <button
                                        onClick={async () => {
                                            if (window.confirm('Are you sure you want to REJECT this application?')) {
                                                const admissionId = selectedEvent.resource.booking.admissionId?._id || selectedEvent.resource.booking.admissionId;
                                                if (!admissionId) {
                                                    toast.error('Admission record not found');
                                                    return;
                                                }
                                                try {
                                                    const res = await updateAdmission(admissionId, { status: 'rejected' });
                                                    if (res.success) {
                                                        toast.success('Application Rejected');
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
                                                const admissionId = selectedEvent.resource.booking.admissionId?._id || selectedEvent.resource.booking.admissionId;
                                                if (!admissionId) {
                                                    toast.error('Admission record not found');
                                                    return;
                                                }
                                                try {
                                                    const res = await updateAdmission(admissionId, { status: 'approved' });
                                                    if (res.success) {
                                                        toast.success('Application Approved');
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
                                onClick={() => {
                                    if (selectedEvent.previousGroup) {
                                        // Return to the group modal
                                        setSelectedGroup(selectedEvent.previousGroup)
                                        setSelectedEvent(null)
                                    } else {
                                        // Just close the modal
                                        setSelectedEvent(null)
                                    }
                                }}
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
