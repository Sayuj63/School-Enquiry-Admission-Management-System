export type SlotStatus = 'available' | 'full' | 'disabled';
export interface CounsellingSlot {
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    bookedCount: number;
    status: SlotStatus;
    createdAt: string;
}
export interface SlotBooking {
    _id: string;
    slotId: string;
    admissionId: string;
    tokenId: string;
    parentEmail: string;
    calendarInviteSent: boolean;
    principalInviteSent: boolean;
    bookedAt: string;
}
export interface CreateSlotRequest {
    date: string;
    startTime: string;
    endTime: string;
}
export interface BookSlotRequest {
    admissionId: string;
}
export interface SlotWithBookings extends CounsellingSlot {
    bookings?: SlotBooking[];
}
//# sourceMappingURL=slot.d.ts.map