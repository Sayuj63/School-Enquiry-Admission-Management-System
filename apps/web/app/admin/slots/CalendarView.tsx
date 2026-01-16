'use client'

import { Slot } from './page'
import SlotCalendar from '../../components/SlotCalendar'

interface CalendarViewProps {
    slots: Slot[]
}

export default function CalendarView({ slots }: CalendarViewProps) {
    return (
        <SlotCalendar slots={slots} type="bookings" />
    )
}

