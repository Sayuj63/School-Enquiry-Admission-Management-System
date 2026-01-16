'use client'

import { useEffect, useState } from 'react'
import SlotCalendar from '../../components/SlotCalendar'
import { getSlots } from '@/lib/api'

export default function PrincipalCalendarPage() {
    const [slots, setSlots] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSlots()
    }, [])

    const fetchSlots = async () => {
        setLoading(true)
        const result = await getSlots()
        if (result.success && result.data) {
            // Filter only slots with bookings
            const bookedSlots = result.data.filter((slot: any) =>
                slot.bookedCount > 0 && slot.bookings && slot.bookings.length > 0
            )
            setSlots(bookedSlots)
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    return (
        <SlotCalendar slots={slots} type="bookings" />
    )
}

