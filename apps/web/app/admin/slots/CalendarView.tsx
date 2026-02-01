'use client'

import { Slot } from './page'
import SlotCalendar from '../../components/SlotCalendar'

interface CalendarViewProps {
    slots: Slot[]
    onSlotSelect?: (slot: Slot) => void
}

export default function CalendarView({ slots, onSlotSelect }: CalendarViewProps) {
    return (
        <SlotCalendar
            slots={slots as any}
            type="available"
            onSelectSlot={onSlotSelect as any}
        />
    )
}

