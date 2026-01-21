'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Trash2, Calendar as CalendarIcon, Loader2, CheckCircle, Clock, X, Phone, User, GraduationCap } from 'lucide-react'
import { getAdmission, updateAdmission, getAvailableSlots, bookSlot, getAdmissionTemplate, getDocumentsList, getCurrentUser } from '@/lib/api'
import { format } from 'date-fns'
import Link from 'next/link'

interface Admission {
    _id: string
    tokenId: string
    studentName: string
    parentName: string
    mobile: string
    email: string
    grade: string
    studentDob?: string
    parentAddress?: string
    parentOccupation?: string
    emergencyContact?: string
    additionalFields: Record<string, any>
    documents: Array<{
        _id: string
        type: string
        fileName: string
        url: string
        uploadedAt: string
    }>
    status: 'draft' | 'submitted' | 'approved' | 'rejected'
    notes?: string
    slotBookingId?: string
}

export default function PrincipalAdmissionDetailPage() {
    const router = useRouter()
    const params = useParams()
    const admissionId = params.id as string

    const [admission, setAdmission] = useState<Admission | null>(null)
    const [slotBooking, setSlotBooking] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [fields, setFields] = useState<any[]>([])

    useEffect(() => {
        fetchData()
    }, [admissionId])

    const fetchData = async () => {
        setLoading(true)
        const [admissionResult, templateResult, userResult] = await Promise.all([
            getAdmission(admissionId),
            getAdmissionTemplate(),
            getCurrentUser()
        ])

        if (userResult.success) setUser(userResult.data)

        if (admissionResult.success && admissionResult.data) {
            setAdmission(admissionResult.data.admission)
            setSlotBooking(admissionResult.data.slotBooking)
        }

        if (templateResult.success && templateResult.data) {
            setFields(templateResult.data.fields || [])
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

    if (!admission) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Admission not found</p>
                <Link href="/principal/admissions" className="text-primary-600 hover:underline mt-4 inline-block">
                    Back to Admissions
                </Link>
            </div>
        )
    }

    const handleDecision = async (status: 'approved' | 'rejected') => {
        let notes = ''
        if (status === 'rejected') {
            const reason = prompt('Please enter reason for rejection:')
            if (reason === null) return
            notes = reason
        } else {
            if (!confirm('Are you sure you want to APPROVE this admission?')) return
        }

        const result = await updateAdmission(admissionId, { status, notes })
        if (result.success) {
            setSuccess(`Admission ${status === 'approved' ? 'approved' : 'rejected'} successfully`)
            fetchData()
        } else {
            setError(result.error || 'Failed to update status')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Link href="/principal/admissions" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4 font-bold">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Principal Review
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                            <GraduationCap className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-black text-gray-900">{admission.studentName}</h2>
                                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-lg border ${admission.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    admission.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                                        'bg-blue-100 text-blue-700 border-blue-200'
                                    }`}>
                                    {admission.status === 'approved' ? 'Accepted' : admission.status === 'rejected' ? 'Rejected' : 'Submitted'}
                                </span>
                            </div>
                            <p className="font-mono text-sm text-gray-500">{admission.tokenId} • Grade {admission.grade}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {admission.status === 'submitted' && (
                            <>
                                <button
                                    onClick={() => handleDecision('rejected')}
                                    className="btn-secondary h-11 px-6 text-red-600 border-red-200 hover:bg-red-50 font-bold"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleDecision('approved')}
                                    className="btn-primary h-11 px-8 bg-emerald-600 hover:bg-emerald-700 border-none shadow-lg shadow-emerald-100 font-bold"
                                >
                                    Approve Admission
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>}
            {success && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-600">{success}</div>}

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="card shadow-md">
                        <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                            <User className="h-5 w-5 text-primary-500" />
                            Student & Parent Information
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-black uppercase text-gray-400">Student Name</label>
                                <p className="text-sm font-bold mt-1">{admission.studentName}</p>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase text-gray-400">Grade Applied</label>
                                <p className="text-sm font-bold mt-1">Grade {admission.grade}</p>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase text-gray-400">Parent Name</label>
                                <p className="text-sm font-bold mt-1">{admission.parentName}</p>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase text-gray-400">Mobile Number</label>
                                <p className="text-sm font-bold mt-1">{admission.mobile}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-black uppercase text-gray-400">Email Address</label>
                                <p className="text-sm font-bold mt-1">{admission.email}</p>
                            </div>

                            {fields.map((field) => {
                                const isCore = ['studentDob', 'parentAddress', 'parentOccupation', 'emergencyContact'].includes(field.name)
                                const value = isCore ? (admission as any)[field.name] : admission.additionalFields[field.name]
                                if (!value) return null

                                return (
                                    <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                                        <label className="text-xs font-black uppercase text-gray-400">{field.label}</label>
                                        <p className="text-sm font-bold mt-1">
                                            {field.type === 'date' ? format(new Date(value), 'dd MMM yyyy') :
                                                typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="card shadow-md">
                        <h3 className="text-lg font-black text-gray-900 mb-6">Submitted Documents</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {admission.documents.map((doc) => (
                                <div key={doc._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-gray-900 truncate" title={doc.type}>{doc.type}</p>
                                        <p className="text-xs text-gray-500 truncate" title={doc.fileName}>{doc.fileName}</p>
                                    </div>
                                    <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-4 px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-black text-primary-600 hover:bg-primary-50 transition-colors"
                                    >
                                        View
                                    </a>
                                </div>
                            ))}
                            {admission.documents.length === 0 && (
                                <p className="text-sm text-gray-500 italic">No documents uploaded</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="card shadow-md border-t-4 border-primary-500">
                        <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary-500" />
                            Interview Status
                        </h3>
                        {slotBooking ? (
                            <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100">
                                <div className="flex items-center text-primary-700 mb-3 font-black text-sm uppercase">
                                    <CheckCircle className="h-4 w-4 mr-2" /> Interview Conducted
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-bold">Date</span>
                                        <span className="font-black">{format(new Date(slotBooking.slotId.date), 'dd MMMM yyyy')}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-bold">Time</span>
                                        <span className="font-black">{slotBooking.slotId.startTime} - {slotBooking.slotId.endTime}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-amber-200 flex items-center justify-center text-amber-700">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <p className="text-xs font-black text-amber-800 leading-tight">Interaction session not yet booked.</p>
                            </div>
                        )}
                    </div>

                    <div className="card shadow-md">
                        <h3 className="text-lg font-black text-gray-900 mb-4">Internal Notes</h3>
                        <div className="p-4 bg-gray-50 rounded-2xl text-sm text-gray-700 italic border border-gray-100 min-h-[100px]">
                            {admission.notes || 'No internal notes provided.'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
