'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Calendar, Users, Clock, Loader2, List, CalendarDays, Search, Trash2, AlertTriangle, X } from 'lucide-react'
import { getSlots, createSlot, updateSlot, getAdmissions, bookSlot, deleteSlot } from '@/lib/api'
import { startOfWeek, format } from 'date-fns'
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

  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const initialView = dateParam === 'today' ? 'list' : 'list'

  const [view, setView] = useState<'list' | 'calendar'>(initialView)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'completed'>('active')

  // Create form state
  const [newSlot, setNewSlot] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    endTime: '10:30'
  })

  // Read URL parameters on mount
  useEffect(() => {
    fetchSlots()
  }, [])

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

    // Validate duration (min 30 min)
    const [startH, startM] = newSlot.startTime.split(':').map(Number);
    const [endH, endM] = newSlot.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

    if (durationMinutes < 30) {
      setError('Counselling slots must be at least 30 minutes long.');
      setCreating(false);
      return;
    }

    const { date, startTime, endTime } = newSlot;
    // Check if slot overlaps with existing slots
    const isOverlapping = slots.some(slot => {
      if (slot.date.split('T')[0] !== date) return false;

      const s1 = startTime;
      const e1 = endTime;
      const s2 = slot.startTime;
      const e2 = slot.endTime;

      return (s1 < e2 && e1 > s2);
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

    if (result.success) {
      fetchSlots()
    } else {
      setError(result.error || 'Failed to update slot')
    }
  }

  const handleDeleteRequest = (slotId: string) => {
    setSlotToDelete(slotId)
    setShowDeleteModal(true)
  }

  const handleDeleteSlot = async () => {
    if (!slotToDelete) return

    setDeleting(true)
    setError('')

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

  // Helper to parse date without timezone shift
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Group slots by date with filtering
  const slotsByDate = slots.reduce((acc, slot) => {
    // Check if slot has passed (date and time)
    const isPast = (() => {
      const [year, month, day] = slot.date.split('T')[0].split('-').map(Number)
      const [hours, minutes] = slot.endTime.split(':').map(Number)
      const slotEndTime = new Date(year, month - 1, day, hours, minutes)
      return slotEndTime < new Date()
    })()

    const isDisabled = slot.status === 'disabled'

    // Apply status filter
    if (statusFilter === 'active') {
      if (isDisabled || isPast) return acc
    } else if (statusFilter === 'disabled') {
      if (slot.status !== 'disabled') return acc
    } else if (statusFilter === 'completed') {
      if (!isPast) return acc
    }

    const dateKey = slot.date.split('T')[0]
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(slot)
    return acc
  }, {} as Record<string, Slot[]>)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Counselling Slots</h2>
          <p className="text-gray-600">Manage available slots for counselling sessions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Slot
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        {/* Status Filters */}
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'active'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('disabled')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'disabled'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Disabled
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === 'completed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Completed
          </button>
        </div>

        {/* View Toggle */}
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors ${view === 'list'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors ${view === 'calendar'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Calendar
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded p-3">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Slots List or Calendar */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : view === 'calendar' ? (
        <CalendarView
          slots={slots}
        />
      ) : Object.keys(slotsByDate).length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No slots created yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Slot
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(slotsByDate).map(([dateKey, daySlots]) => (
            <div key={dateKey} className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {format(parseLocalDate(dateKey), 'EEEE, dd MMMM yyyy')}
              </h3>
              <div className="space-y-3">
                {daySlots.map((slot) => (
                  <div
                    key={slot._id}
                    className={`p-4 rounded-lg border ${statusColors[slot.status]}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          <span className="font-medium">
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span>
                            {slot.bookedCount}/{slot.capacity} booked
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm capitalize">{slot.status}</span>
                        {!(() => {
                          const [year, month, day] = slot.date.split('T')[0].split('-').map(Number)
                          const [hours, minutes] = slot.endTime.split(':').map(Number)
                          const slotEndTime = new Date(year, month - 1, day, hours, minutes)
                          return slotEndTime < new Date()
                        })() && (
                            <>
                              <button
                                onClick={() => handleToggleSlot(slot._id, slot.status)}
                                className="btn-secondary text-sm py-1 px-3"
                                disabled={slot.status !== 'disabled' && slot.bookedCount > 0}
                                title={slot.bookedCount > 0 ? "Cannot disable a slot with bookings" : ""}
                              >
                                {slot.status === 'disabled' ? 'Enable' : 'Disable'}
                              </button>
                              {slot.status === 'available' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedSlot(slot)
                                      setShowAssignModal(true)
                                      fetchEligibleAdmissions()
                                    }}
                                    className="bg-primary-600 text-white hover:bg-primary-700 text-sm py-1 px-3 rounded-md transition-colors"
                                  >
                                    Assign Student
                                  </button>
                                  {slot.bookedCount === 0 && (
                                    <button
                                      onClick={() => handleDeleteRequest(slot._id)}
                                      className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                      title="Delete Slot"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                      </div>
                    </div>

                    {/* Show bookings if any */}
                    {slot.bookings && slot.bookings.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                        <p className="text-sm font-medium mb-2">Bookings:</p>
                        <div className="space-y-1">
                          {slot.bookings.map((booking) => (
                            <div key={booking._id} className="text-sm flex items-center gap-2">
                              <span className="font-mono">{booking.tokenId}</span>
                              <span>-</span>
                              <span>{booking.admissionId?.studentName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            <button
              onClick={() => {
                setShowCreateModal(false)
                setError('')
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-semibold mb-4">Create New Slot</h2>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={newSlot.date}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="time"
                    className="input"
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input
                    type="time"
                    className="input"
                    value={newSlot.endTime}
                    onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  <strong>Note:</strong> Counselling slots must be at least 30 minutes long. Each slot has a fixed capacity of 3 parents.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setError('')
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSlot}
                disabled={creating}
                className="btn-primary flex-1"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Create Slot'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Slot Modal (Details for Calendar) */}
      {(() => {
        // Find the most up-to-date version of the selected slot from the slots array
        const currentSlot = selectedSlot ? slots.find(s => s._id === selectedSlot._id) : null;
        if (!currentSlot) return null;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 relative">
              <button
                onClick={() => setSelectedSlot(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              <h3 className="text-lg font-semibold mb-2">
                {format(parseLocalDate(currentSlot.date), 'MMMM d, yyyy')}
              </h3>
              <div className="flex items-center text-gray-600 mb-4">
                <Clock className="h-4 w-4 mr-2" />
                <span>{currentSlot.startTime} - {currentSlot.endTime}</span>
              </div>

              <div className={`p-4 rounded-lg border mb-4 ${statusColors[currentSlot.status]}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium capitalize">{currentSlot.status}</span>
                  <span className="text-sm border border-current px-2 py-0.5 rounded-full">
                    {currentSlot.bookedCount}/{currentSlot.capacity} Booked
                  </span>
                </div>

                {currentSlot.bookings && currentSlot.bookings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                    <p className="text-xs font-semibold mb-1 opacity-80">Bookings:</p>
                    <ul className="text-sm space-y-1">
                      {currentSlot.bookings.map(b => (
                        <li key={b._id} className="flex justify-between">
                          <span>{b.admissionId?.studentName || 'Unknown'}</span>
                          <span className="opacity-70 text-xs font-mono">{b.tokenId}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="btn-secondary w-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Assign Student Modal */}
      {showAssignModal && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Assign Student to Slot</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedSlot(null)
                  setAssignSearch('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {format(parseLocalDate(selectedSlot.date), 'EEEE, MMMM d')}
                </p>
                <p className="text-xs text-blue-700">
                  {selectedSlot.startTime} - {selectedSlot.endTime}
                </p>
              </div>
              <div className="text-xs text-blue-700 font-medium">
                {selectedSlot.bookedCount}/{selectedSlot.capacity} Booked
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or Token ID..."
                className="input pl-10"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto mb-4 border rounded-lg">
              {fetchingAdmissions ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary-600 mb-2" />
                  <p className="text-sm text-gray-500">Loading admissions...</p>
                </div>
              ) : eligibleAdmissions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No eligible admissions found.
                </div>
              ) : (
                <div className="divide-y">
                  {eligibleAdmissions
                    .filter(a =>
                      a.studentName.toLowerCase().includes(assignSearch.toLowerCase()) ||
                      a.tokenId.toLowerCase().includes(assignSearch.toLowerCase())
                    )
                    .map((admission) => (
                      <div
                        key={admission._id}
                        className="p-4 hover:bg-gray-50 flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{admission.studentName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {admission.tokenId}
                            </span>
                            <span>•</span>
                            <span>Grade {admission.grade}</span>
                            <span>•</span>
                            <span>{admission.parentName}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignSlot(admission._id)}
                          disabled={assigning}
                          className="bg-primary-50 text-primary-600 hover:bg-primary-600 hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {assigning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Assign'
                          )}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowAssignModal(false)
                setSelectedSlot(null)
                setAssignSearch('')
              }}
              className="btn-secondary w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 relative">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setSlotToDelete(null)
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4 mx-auto">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">Delete Slot</h2>
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to delete this slot? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSlotToDelete(null)
                }}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSlot}
                disabled={deleting}
                className="bg-red-600 text-white hover:bg-red-700 font-medium py-2 px-4 rounded-md transition-colors flex-1 flex items-center justify-center"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
