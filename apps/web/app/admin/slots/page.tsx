'use client'

import { useEffect, useState } from 'react'
import { Plus, Calendar, Users, Clock, Loader2 } from 'lucide-react'
import { getSlots, createSlot, updateSlot } from '@/lib/api'
import { format, addDays, startOfWeek } from 'date-fns'

interface Slot {
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

  // Create form state
  const [newSlot, setNewSlot] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    endTime: '10:30'
  })

  useEffect(() => {
    fetchSlots()
  }, [])

  const fetchSlots = async () => {
    setLoading(true)
    const today = new Date()
    const result = await getSlots({
      dateFrom: format(today, 'yyyy-MM-dd'),
      dateTo: format(addDays(today, 30), 'yyyy-MM-dd')
    })

    if (result.success && result.data) {
      setSlots(result.data)
    }
    setLoading(false)
  }

  const handleCreateSlot = async () => {
    setCreating(true)
    setError('')

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

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    const dateKey = format(new Date(slot.date), 'yyyy-MM-dd')
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

      {/* Slots List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
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
                {format(new Date(dateKey), 'EEEE, dd MMMM yyyy')}
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
                        <button
                          onClick={() => handleToggleSlot(slot._id, slot.status)}
                          className="btn-secondary text-sm py-1 px-3"
                          disabled={slot.status === 'full'}
                        >
                          {slot.status === 'disabled' ? 'Enable' : 'Disable'}
                        </button>
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Each slot has a fixed capacity of 3 parents.
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
    </div>
  )
}
