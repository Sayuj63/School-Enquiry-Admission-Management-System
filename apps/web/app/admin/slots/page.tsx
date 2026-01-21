'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Calendar, Users, Clock, Loader2, List, CalendarDays, Search, Trash2, AlertTriangle, X } from 'lucide-react'
import { getSlots, createSlot, updateSlot, getAdmissions, bookSlot, deleteSlot, getCurrentUser } from '@/lib/api'
import { format } from 'date-fns'
import CalendarView from './CalendarView'

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
  disabled: 'bg-gray-100 text-gray-800 border-gray-200'
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
    endTime: '10:30'
  })

  useEffect(() => {
    fetchSlots()
    fetchUser()
  }, [])

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
        endTime: '10:30'
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

  const fetchEligibleAdmissions = async () => {
    setFetchingAdmissions(true)
    const result = await getAdmissions({ noSlot: true, limit: 100 })
    if (result.success && result.data) {
      setEligibleAdmissions(result.data.admissions)
    }
    setFetchingAdmissions(false)
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

  const isSlotPast = (slot: Slot) => {
    const [year, month, day] = slot.date.split('T')[0].split('-').map(Number)
    const [hours, minutes] = slot.endTime.split(':').map(Number)
    const slotEndTime = new Date(year, month - 1, day, hours, minutes)
    return slotEndTime < new Date()
  }

  const slotsByDate = slots.reduce((acc, slot) => {
    const isPast = isSlotPast(slot)
    const isDisabled = slot.status === 'disabled'
    if (statusFilter === 'active' && (isDisabled || isPast)) return acc
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
        {!isPrincipal && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Slot
          </button>
        )}
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
        <CalendarView slots={slots} />
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
                    const isPast = isSlotPast(slot)
                    return (
                      <div key={slot._id} className={`p-4 rounded-lg border ${statusColors[slot.status]} ${isPast ? 'opacity-75' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center"><Clock className="h-4 w-4 mr-2" />{slot.startTime} - {slot.endTime}</div>
                            <div className="flex items-center"><Users className="h-4 w-4 mr-2" />{slot.bookedCount}/{slot.capacity} booked</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm capitalize font-medium">
                              {isPast ? 'Completed' : slot.status}
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
              {eligibleAdmissions.filter(a =>
                a.studentName.toLowerCase().includes(assignSearch.toLowerCase()) ||
                a.tokenId.toLowerCase().includes(assignSearch.toLowerCase())
              ).map(adm => (
                <div key={adm._id} className="p-3 border rounded-lg flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <p className="font-bold text-gray-900">{adm.studentName}</p>
                    <p className="text-xs text-gray-500 font-mono">{adm.tokenId} • Grade {adm.grade}</p>
                  </div>
                  <button onClick={() => handleAssignSlot(adm._id)} disabled={assigning} className="btn-primary py-1 px-4 text-xs font-bold">Assign</button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAssignModal(false)} className="btn-secondary mt-4 w-full font-bold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
