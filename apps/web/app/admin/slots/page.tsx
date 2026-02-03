'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Calendar, Users, Clock, Loader2, List, CalendarDays, Search, Trash2, AlertTriangle, X, User } from 'lucide-react'
import { getSlots, createSlot, updateSlot, getAdmissions, bookSlot, deleteSlot, getCurrentUser, generateSaturdaySlots, bulkGenerateSlots, markNoShow, cancelSlotBySchool, api } from '@/lib/api'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import CalendarView from './CalendarView'
import ConfirmModal from '@/app/components/ConfirmModal'

export interface Slot {
  _id: string
  date: string
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  status: 'available' | 'full' | 'disabled'
  bookings?: Array<{
    _id: string
    tokenId: string
    admissionId: {
      studentName: string
      parentName: string
    }
  }>
}

const statusColors = {
  available: 'bg-green-100 text-green-800 border-green-200',
  full: 'bg-red-100 text-red-800 border-red-200',
  disabled: 'bg-gray-100 text-gray-800 border-gray-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200'
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [eligibleAdmissions, setEligibleAdmissions] = useState<any[]>([])
  const [assignSearch, setAssignSearch] = useState('')
  const [fetchingAdmissions, setFetchingAdmissions] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [user, setUser] = useState<any>(null)

  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'completed'>('active')

  const [newSlot, setNewSlot] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    endTime: '10:30',
    capacity: 3
  })

  // Bulk Generation State
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkAvailability, setBulkAvailability] = useState<Array<{ date: string; startTime: string; endTime: string }>>([
    { date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '12:00' }
  ])

  // Booking Management State
  const [selectedSlotForBookings, setSelectedSlotForBookings] = useState<Slot | null>(null)
  const [showBookingsModal, setShowBookingsModal] = useState(false)
  const [slotBookings, setSlotBookings] = useState<any[]>([])
  const [fetchingBookings, setFetchingBookings] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'danger' | 'warning'
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => { } })

  useEffect(() => {
    fetchSlots()
    fetchUser()
  }, [])

  // Auto-clear alerts after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const fetchUser = async () => {
    const result = await getCurrentUser()
    if (result.success) {
      setUser(result.data)
    }
  }

  const fetchSlots = async () => {
    setLoading(true)
    const result = await getSlots({})
    if (result.success && result.data) {
      setSlots(result.data)
    }
    setLoading(false)
  }

  const handleCreateSlot = async () => {
    setCreating(true)
    setError('')
    const [startH, startM] = newSlot.startTime.split(':').map(Number);
    const [endH, endM] = newSlot.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

    if (durationMinutes < 30) {
      setError('Counselling slots must be at least 30 minutes long.');
      setCreating(false);
      return;
    }

    const { date, startTime, endTime } = newSlot;
    const isOverlapping = slots.some(slot => {
      if (slot.date.split('T')[0] !== date) return false;
      return (startTime < slot.endTime && endTime > slot.startTime);
    });

    if (isOverlapping) {
      setError('This slot overlaps with an existing slot.');
      setCreating(false);
      return;
    }

    const result = await createSlot(newSlot)
    if (result.success) {
      setSuccess('Slot created successfully')
      setShowCreateModal(false)
      setNewSlot({
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '10:00',
        endTime: '10:30',
        capacity: 3
      })
      fetchSlots()
    } else {
      setError(result.error || 'Failed to create slot')
    }
    setCreating(false)
  }

  const handleToggleSlot = async (slotId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'disabled' ? 'available' : 'disabled'
    const result = await updateSlot(slotId, { status: newStatus })
    if (result.success) fetchSlots()
    else setError(result.error || 'Failed to update slot')
  }

  const handleUpdateCapacity = async (slotId: string, newCapacity: number) => {
    const result = await updateSlot(slotId, { capacity: newCapacity })
    if (result.success) {
      setSuccess('Capacity updated')
      fetchSlots()
    } else {
      setError(result.error || 'Failed to update capacity')
    }
  }

  const handleGenerateSaturdaySlots = async () => {
    setLoading(true)
    const result = await generateSaturdaySlots()
    if (result.success) {
      setSuccess(`Successfully generated ${result.data.length} Saturday slots`)
      fetchSlots()
    } else {
      setError(result.error || 'Failed to generate Saturday slots')
    }
    setLoading(false)
  }

  const handleDeleteRequest = (slotId: string) => {
    setSlotToDelete(slotId)
    setShowDeleteModal(true)
  }

  const handleDeleteSlot = async () => {
    if (!slotToDelete) return
    setDeleting(true)
    const result = await deleteSlot(slotToDelete)
    if (result.success) {
      setSuccess('Slot deleted successfully')
      setShowDeleteModal(false)
      setSlotToDelete(null)
      fetchSlots()
    } else {
      setError(result.error || 'Failed to delete slot')
    }
    setDeleting(false)
  }

  const handleBulkGenerate = async () => {
    setCreating(true)
    const result = await bulkGenerateSlots(bulkAvailability)
    if (result.success) {
      setSuccess(`Successfully generated ${(result as any).count} slots`)
      setShowBulkModal(false)
      fetchSlots()
    } else {
      setError(result.error || 'Failed to generate slots')
    }
    setCreating(false)
  }

  const addBulkRow = () => {
    setBulkAvailability([...bulkAvailability, { date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '12:00' }])
  }

  const removeBulkRow = (index: number) => {
    setBulkAvailability(bulkAvailability.filter((_, i) => i !== index))
  }

  const updateBulkRow = (index: number, updates: any) => {
    const updated = [...bulkAvailability]
    updated[index] = { ...updated[index], ...updates }
    setBulkAvailability(updated)
  }

  const fetchEligibleAdmissions = async () => {
    setFetchingAdmissions(true)
    const result = await getAdmissions({ limit: 200 })
    if (result.success && result.data) {
      setEligibleAdmissions(result.data.admissions)
    }
    setFetchingAdmissions(false)
  }

  const handleCancelSlotBySchool = async (slotId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Slot & Reschedule',
      message: 'This will CANCEL the slot and AUTOMATICALLY reschedule all parents to the next available date. Original capacities will be adjusted +1. Proceed?',
      variant: 'warning',
      onConfirm: async () => {
        setLoading(true)
        const result = await cancelSlotBySchool(slotId)
        if (result.success) {
          setSuccess(result.message || 'Slot cancelled')
          fetchSlots()
        } else {
          setError(result.error || 'Failed to cancel slot')
        }
        setLoading(false)
      }
    })
  }

  const handleFetchBookings = async (slot: Slot) => {
    setSelectedSlotForBookings(slot)
    setFetchingBookings(true)
    setShowBookingsModal(true)
    const result = await api.get<any>(`/api/slots/${slot._id}/bookings`)
    if (result.success) {
      setSlotBookings(result.data)
    }
    setFetchingBookings(false)
  }

  const handleMarkNoShow = async (bookingId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Mark as No-Show',
      message: 'Marking this as No-Show will automatically move the parent to the next available slot (First No-Show) or to the Waitlist (Second No-Show). Proceed?',
      variant: 'warning',
      onConfirm: async () => {
        const result = await markNoShow(bookingId)
        if (result.success) {
          setSuccess(result.message || 'Marked as no-show')
          if (selectedSlotForBookings) handleFetchBookings(selectedSlotForBookings)
          fetchSlots()
        } else {
          setError(result.error || 'Failed to mark no-show')
        }
      }
    })
  }

  const handleAssignSlot = async (admissionId: string) => {
    if (!selectedSlot) return
    setAssigning(true)
    const result = await bookSlot(selectedSlot._id, admissionId)
    if (result.success) {
      setSuccess('Slot assigned successfully')
      setShowAssignModal(false)
      fetchSlots()
    } else {
      setError(result.error || 'Failed to assign slot')
    }
    setAssigning(false)
  }

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const getSlotTimeState = (slot: Slot) => {
    const [year, month, day] = slot.date.split('T')[0].split('-').map(Number)
    const [startH, startM] = slot.startTime.split(':').map(Number)
    const [endH, endM] = slot.endTime.split(':').map(Number)

    const now = new Date()
    const startTime = new Date(year, month - 1, day, startH, startM)
    const endTime = new Date(year, month - 1, day, endH, endM)

    if (now > endTime) return 'past'
    if (now >= startTime && now <= endTime) return 'ongoing'
    return 'upcoming'
  }

  const isSlotPast = (slot: Slot) => getSlotTimeState(slot) === 'past'

  const slotsByDate = slots.reduce((acc, slot) => {
    const timeState = getSlotTimeState(slot)
    const isPast = timeState === 'past'
    const isDisabled = slot.status === 'disabled'

    // For active filter: include upcoming, ongoing, and today's completed slots
    if (statusFilter === 'active') {
      const isToday = isSameDay(parseLocalDate(slot.date), new Date())
      if (isDisabled) return acc;
      if (isPast && !isToday) return acc;
    }

    if (statusFilter === 'disabled' && slot.status !== 'disabled') return acc
    if (statusFilter === 'completed' && !isPast) return acc

    const dateKey = slot.date.split('T')[0]
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(slot)
    return acc
  }, {} as Record<string, Slot[]>)

  const isPrincipal = user?.role === 'principal'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Counselling Slots</h2>
          <p className="text-gray-600">Manage available slots for counselling sessions</p>
        </div>
        <div className="flex gap-2">
          {!isPrincipal && (
            <>
              <button onClick={() => setShowBulkModal(true)} className="btn-secondary bg-primary-50 border-primary-100 text-primary-700 hover:bg-primary-100">
                <Calendar className="h-4 w-4 mr-2" />
                Configure Principal Availability
              </button>
              <button onClick={handleGenerateSaturdaySlots} className="btn-secondary">
                <Calendar className="h-4 w-4 mr-2" />
                Release Sat Slots
              </button>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Slot
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          {['all', 'active', 'disabled', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${statusFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button onClick={() => setView('list')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <List className="h-4 w-4 mr-2" /> List
          </button>
          <button onClick={() => setView('calendar')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <CalendarDays className="h-4 w-4 mr-2" /> Calendar
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-600">{success}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary-600" /></div>
      ) : view === 'calendar' ? (
        <CalendarView
          slots={slots}
          onSlotSelect={(slot) => {
            setSelectedSlot(slot);
            setShowAssignModal(true);
            fetchEligibleAdmissions();
          }}
        />
      ) : (
        <div className="space-y-6">
          {Object.keys(slotsByDate).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No {statusFilter === 'all' ? '' : statusFilter} slots found</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                {statusFilter === 'completed'
                  ? "There are no completed counselling slots yet."
                  : "There are no slots matching your criteria."}
              </p>
            </div>
          ) : (
            Object.entries(slotsByDate).map(([dateKey, daySlots]) => (
              <div key={dateKey} className="card">
                <h3 className="text-lg font-semibold mb-4">{format(parseLocalDate(dateKey), 'EEEE, dd MMMM yyyy')}</h3>
                <div className="space-y-3">
                  {daySlots.map(slot => {
                    const timeState = getSlotTimeState(slot)
                    const isPast = timeState === 'past'
                    const isOngoing = timeState === 'ongoing'

                    let bgClass = statusColors[slot.status]
                    if (isPast) bgClass = statusColors.completed
                    if (isOngoing) bgClass = 'bg-amber-100 text-amber-800 border-amber-200'

                    return (
                      <div key={slot._id} className={`p-4 rounded-lg border ${bgClass} ${isPast ? 'opacity-75' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center font-bold text-gray-900"><Clock className="h-4 w-4 mr-2" />{slot.startTime} - {slot.endTime}</div>
                            <div className="flex items-center bg-white px-2 py-1 rounded border shadow-sm">
                              <Users className="h-3 w-3 mr-2 text-gray-400" />
                              <span className="mr-2 font-medium">{slot.bookedCount} /</span>
                              <input
                                type="number"
                                className="w-10 bg-transparent border-none p-0 text-sm font-bold focus:ring-0"
                                value={slot.capacity}
                                onChange={(e) => handleUpdateCapacity(slot._id, parseInt(e.target.value))}
                                min={slot.bookedCount}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm capitalize font-black tracking-tight">
                              {isPast ? '✓ Completed' : isOngoing ? '● Ongoing' : slot.status}
                            </span>
                            {!isPrincipal && !isPast && (
                              <>
                                <button
                                  onClick={() => handleToggleSlot(slot._id, slot.status)}
                                  className="btn-secondary text-xs px-2 py-1"
                                  disabled={slot.status !== 'disabled' && slot.bookedCount > 0}
                                >
                                  {slot.status === 'disabled' ? 'Enable' : 'Disable'}
                                </button>
                                {slot.status === 'available' && (
                                  <button
                                    onClick={() => { setSelectedSlot(slot); setShowAssignModal(true); fetchEligibleAdmissions(); }}
                                    className="bg-primary-600 text-white text-xs px-2 py-1 rounded hover:bg-primary-700"
                                  >
                                    Assign
                                  </button>
                                )}
                                {slot.bookedCount > 0 && (
                                  <button
                                    onClick={() => handleFetchBookings(slot)}
                                    className="text-primary-600 hover:bg-primary-50 text-xs px-2 py-1 rounded border border-primary-100"
                                  >
                                    Bookings ({slot.bookedCount}p)
                                  </button>
                                )}
                                {slot.bookedCount > 0 && (
                                  <button
                                    onClick={() => handleCancelSlotBySchool(slot._id)}
                                    className="text-amber-600 hover:bg-amber-50 text-xs px-2 py-1 rounded border border-amber-100"
                                  >
                                    Cancel & Reschedule
                                  </button>
                                )}
                                {slot.bookedCount === 0 && (
                                  <button onClick={() => handleDeleteRequest(slot._id)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                            {!isPrincipal && isPast && (
                              <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded">
                                Archived
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Create New Slot</h2>
            <div className="space-y-4">
              <div><label className="label">Date</label><input type="date" className="input" value={newSlot.date} onChange={e => setNewSlot({ ...newSlot, date: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Start</label><input type="time" className="input" value={newSlot.startTime} onChange={e => setNewSlot({ ...newSlot, startTime: e.target.value })} /></div>
                <div><label className="label">End</label><input type="time" className="input" value={newSlot.endTime} onChange={e => setNewSlot({ ...newSlot, endTime: e.target.value })} /></div>
              </div>
              <div><label className="label">Capacity (Parents)</label><input type="number" className="input" value={newSlot.capacity} onChange={e => setNewSlot({ ...newSlot, capacity: parseInt(e.target.value) })} min="1" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreateSlot} disabled={creating} className="btn-primary flex-1">{creating ? '...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold mb-2 flex items-center text-red-600"><AlertTriangle className="mr-2" /> Delete Slot</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this slot? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteSlot} disabled={deleting} className="btn-primary bg-red-600 hover:bg-red-700 border-none flex-1 font-bold">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black uppercase tracking-tighter">Configure Principal Availability</h2>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-6 font-medium">
              Specify the time periods when the Principal is available for counselling. The system will automatically generate 30-minute slots (or as configured in settings) within these periods.
            </p>

            <div className="space-y-4">
              {bulkAvailability.map((row, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Date</label>
                    <input type="date" className="input text-sm" value={row.date} onChange={e => updateBulkRow(index, { date: e.target.value })} />
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Start Time</label>
                    <input type="time" className="input text-sm" value={row.startTime} onChange={e => updateBulkRow(index, { startTime: e.target.value })} />
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] font-bold uppercase text-gray-400">End Time</label>
                    <input type="time" className="input text-sm" value={row.endTime} onChange={e => updateBulkRow(index, { endTime: e.target.value })} />
                  </div>
                  <button onClick={() => removeBulkRow(index)} className="p-2 text-red-500 hover:bg-red-50 rounded" disabled={bulkAvailability.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button onClick={addBulkRow} className="text-sm text-primary-600 font-medium hover:underline flex items-center">
                <Plus className="h-4 w-4 mr-1" /> Add Period
              </button>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowBulkModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleBulkGenerate} disabled={creating} className="btn-primary flex-1 py-3 grad-primary shadow-lg border-none font-black uppercase tracking-widest text-xs">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                Set Availability & Create Slots
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-semibold mb-4">Assign Student</h2>
            <input
              type="text"
              className="input mb-4"
              placeholder="Search student or token ID..."
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
            />
            <div className="flex-1 overflow-y-auto space-y-2">
              {eligibleAdmissions
                .filter(a =>
                  a.studentName.toLowerCase().includes(assignSearch.toLowerCase()) ||
                  a.tokenId.toLowerCase().includes(assignSearch.toLowerCase())
                )
                .sort((a, b) => {
                  // Put students without a slot at the top
                  if (!a.slotBookingId && b.slotBookingId) return -1;
                  if (a.slotBookingId && !b.slotBookingId) return 1;
                  return 0;
                })
                .map(adm => (
                  <div key={adm._id} className={`p-3 border rounded-lg flex justify-between items-center transition-all ${adm.slotBookingId ? 'bg-amber-50/50 border-amber-100' : 'bg-white hover:bg-gray-50'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{adm.studentName}</p>
                        {adm.slotBookingId && (
                          <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Already Assigned</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{adm.tokenId} • Grade {adm.grade}</p>
                    </div>
                    <button
                      onClick={() => handleAssignSlot(adm._id)}
                      disabled={assigning}
                      className={`py-1.5 px-4 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${adm.slotBookingId ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : 'btn-primary'}`}
                    >
                      {adm.slotBookingId ? 'Reassign' : 'Assign'}
                    </button>
                  </div>
                ))}
            </div>
            <button onClick={() => setShowAssignModal(false)} className="btn-secondary mt-4 w-full font-bold">Cancel</button>
          </div>
        </div>
      )}
      {showBookingsModal && selectedSlotForBookings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Bookings</h2>
                <p className="text-xs text-gray-500">{format(parseLocalDate(selectedSlotForBookings.date), 'dd MMM yyyy')} • {selectedSlotForBookings.startTime} - {selectedSlotForBookings.endTime}</p>
              </div>
              <button onClick={() => setShowBookingsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {fetchingBookings ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary-600" /></div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {slotBookings.map((booking) => (
                  <div key={booking._id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm">
                        <User className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{(booking.admissionId as any)?.studentName || 'Student'}</p>
                        <p className="text-xs text-gray-500">{(booking.admissionId as any)?.parentName} • {booking.tokenId}</p>
                        {(booking.admissionId as any)?.noShowCount > 0 && (
                          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-700">
                            No-Show #{(booking.admissionId as any).noShowCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMarkNoShow(booking._id)}
                        className="text-[10px] font-black uppercase px-3 py-1.5 bg-white text-red-600 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        No-Show
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setShowBookingsModal(false)} className="btn-secondary mt-6 w-full py-3 font-black uppercase tracking-widest text-xs">Close</button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText="Proceed"
      />
    </div>
  )
}
