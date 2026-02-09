'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GraduationCap, ArrowLeft, Loader2, Calendar, FileText, CheckCircle, Clock, Upload, Trash2, ExternalLink, LogOut } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
    getEnquiryByToken,
    uploadParentDocument,
    deleteParentDocument,
    getRescheduleOptions,
    rescheduleSlotByParent,
    getAvailableSlots,
    bookSlotByParent
} from '@/lib/api'
import ConfirmModal from '@/app/components/ConfirmModal'

const REQUIRED_DOCUMENTS = [
    'Birth Certificate',
    'Aadhaar Card (Student)',
    'Aadhaar Card (Parent)',
    'Previous School Report Card',
    'Transfer Certificate'
]

export default function ParentEnquiryDetail() {
    const { tokenId } = useParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [uploadLoading, setUploadLoading] = useState<string | null>(null)
    const [data, setData] = useState<any>(null)
    const [error, setError] = useState('')
    const [rescheduleOptions, setRescheduleOptions] = useState<any[]>([])
    const [availableSlots, setAvailableSlots] = useState<any[]>([])
    const [showReschedule, setShowReschedule] = useState(false)
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [rescheduling, setRescheduling] = useState(false)
    const [booking, setBooking] = useState(false)
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean
        title: string
        message: string
        variant: 'danger' | 'warning'
        onConfirm: () => void
    }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => { } })

    // Auto-clear alerts after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError('')
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [error])

    const fetchData = async () => {
        try {
            const result = await getEnquiryByToken(tokenId as string)
            if (result.success) {
                setData(result.data)
                // Fetch reschedule options only if a slot is already booked
                if (result.data.slot) {
                    const optionsRes = await getRescheduleOptions(tokenId as string)
                    if (optionsRes.success) {
                        setRescheduleOptions(optionsRes.data)
                    }
                }
            } else {
                setError(result.error || 'Failed to fetch details')
                if (result.error === 'Unauthorized access to this enquiry') {
                    router.push('/parent/login')
                }
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async (type: string, file: File) => {
        setUploadLoading(type)

        // Client-side validation
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast.error('File size exceeds 5MB limit. Please choose a smaller file.')
            setUploadLoading(null)
            return
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Only PDF, JPG, and PNG files are allowed.')
            setUploadLoading(null)
            return
        }

        try {
            const res = await uploadParentDocument(tokenId as string, type, file)
            if (res.success) {
                toast.success('Document uploaded successfully!')
                await fetchData()
            } else {
                // Display specific error message from server
                const errorMsg = res.error || 'Upload failed. Please try again.'
                toast.error(errorMsg)
            }
        } catch (err: any) {
            // Handle network errors
            let errorMessage = 'Upload failed due to a network error. Please check your connection and try again.'
            if (err.message) {
                if (err.message.includes('timeout')) {
                    errorMessage = 'Upload timed out. Please try again with a better connection.'
                } else if (err.message.includes('Failed to fetch')) {
                    errorMessage = 'Cannot connect to server. Please check your internet connection.'
                }
            }
            toast.error(errorMessage)
        } finally {
            setUploadLoading(null)
        }
    }

    const handleDelete = async (docId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Document',
            message: 'Are you sure you want to delete this document? This action cannot be undone.',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    const res = await deleteParentDocument(tokenId as string, docId)
                    if (res.success) {
                        await fetchData()
                    } else {
                        toast.error(res.error || 'Delete failed')
                    }
                } catch (err) {
                    toast.error('Delete failed')
                }
            }
        })
    }

    const handleReschedule = async (slotId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Move to Earlier Slot',
            message: 'Are you sure you want to move to this earlier slot? Your current slot will be released.',
            variant: 'warning',
            onConfirm: async () => {
                setRescheduling(true)
                try {
                    const res = await rescheduleSlotByParent(tokenId as string, slotId)
                    if (res.success) {
                        toast.success('Slot updated successfully!')
                        setShowReschedule(false)
                        await fetchData()
                    } else {
                        toast.error(res.error || 'Failed to reschedule')
                    }
                } catch (err) {
                    toast.error('An error occurred while rescheduling')
                } finally {
                    setRescheduling(false)
                }
            }
        })
    }

    const handleBook = async (slotId: string) => {
        setBooking(true)
        try {
            const res = await bookSlotByParent(tokenId as string, slotId)
            if (res.success) {
                toast.success('Slot booked successfully!')
                setShowBookingModal(false)
                await fetchData()
            } else {
                toast.error(res.error || 'Failed to book slot')
            }
        } catch (err) {
            toast.error('An error occurred while booking')
        } finally {
            setBooking(false)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('parent_session');
        router.push('/parent/login');
    }

    const fetchAvailableSlots = async () => {
        try {
            const res = await getAvailableSlots()
            if (res.success) {
                setAvailableSlots(res.data)
                setShowBookingModal(true)
            }
        } catch (err) {
            toast.error('Failed to load available slots')
        }
    }

    useEffect(() => {
        if (tokenId && tokenId !== 'undefined') {
            fetchData()
        } else {
            setError('Invalid Application ID. Please log in again.');
            setLoading(false);
        }
    }, [tokenId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 text-red-700 p-6 rounded-lg border border-red-100 max-w-md w-full text-center">
                    <h2 className="text-xl font-bold mb-2">Error</h2>
                    <p className="mb-6">{error}</p>
                    <Link href="/parent/login" className="btn-primary inline-flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Login
                    </Link>
                </div>
            </div>
        )
    }

    const { enquiry, admission, slot } = data

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={() => router.back()} className="mr-4 text-gray-400 hover:text-gray-600 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <h1 className="font-bold text-gray-900">Application Status</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm font-mono text-gray-500 hidden sm:block">{tokenId}</div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center text-sm font-medium text-red-500 hover:text-red-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-red-100 shadow-sm"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Status Header */}
                <div className="card p-8 bg-white shadow-sm border-t-4 border-primary-600">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">{enquiry.childName}</h2>
                            <p className="text-gray-500">{enquiry.grade} • Looking for admission in 2026-27</p>
                        </div>
                        <div className="flex flex-col items-end">
                            {admission ? (
                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase ${(admission.status === 'approved' || admission.status === 'confirmed') ? 'bg-green-100 text-green-700' :
                                    admission.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        admission.status === 'waitlisted' ? 'bg-amber-100 text-amber-700' :
                                            'bg-blue-100 text-blue-700'
                                    }`}>
                                    {admission.status === 'approved' || admission.status === 'confirmed' ? 'ADMISSION CONFIRMED' : admission.status.replace('_', ' ')}
                                </span>
                            ) : (
                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase ${enquiry.status === 'token_number_generated' ? 'bg-blue-100 text-blue-700' :
                                    enquiry.status === 'converted' ? 'bg-green-100 text-green-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                    {enquiry.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </span>
                            )}
                            <p className="text-xs text-gray-400 mt-2">Submitted on {new Date(enquiry.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                {/* Status Banners */}
                {admission?.status === 'rejected' && (
                    <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-red-100 p-2 rounded-xl">
                            <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-900">Application Rejected</h3>
                            <p className="text-red-700 text-sm mt-1">
                                We regret to inform you that we are unable to proceed with your admission at this time.
                                {admission.notes && <span className="block mt-2 font-medium italic">Reason: {admission.notes}</span>}
                            </p>
                        </div>
                    </div>
                )}

                {(admission?.status === 'approved' || admission?.status === 'confirmed') && (
                    <div className="bg-green-50 border border-green-200 rounded-3xl p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-green-100 p-2 rounded-xl">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-green-900">Admission Confirmed!</h3>
                            <p className="text-green-700 text-sm mt-1">
                                Congratulations! Your admission for {enquiry.childName} has been approved.
                                Our admissions team will contact you shortly regarding the next steps and fee payment.
                            </p>
                        </div>
                    </div>
                )}

                {admission?.status === 'waitlisted' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-amber-100 p-2 rounded-xl">
                            <Clock className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-amber-900">Positioned on Waitlist</h3>
                            <p className="text-amber-700 text-sm mt-1">
                                Your application has been moved to the waitlist. We will notify you immediately if a seat becomes available.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Left Column - Details */}
                    <div className="md:col-span-2 space-y-8">
                        {/* Student Details */}
                        <section className="card p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center">
                                <GraduationCap className="h-5 w-5 mr-2 text-primary-600" />
                                Student Details
                            </h3>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Student Name</p>
                                    <p className="font-medium uppercase tracking-tight">{enquiry.childName}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Grade Applied</p>
                                    <p className="font-medium">Grade {enquiry.grade}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Date of Birth</p>
                                    <p className="font-medium">{enquiry.dob ? new Date(enquiry.dob).toLocaleDateString('en-GB') : '—'}</p>
                                </div>
                            </div>
                        </section>

                        {/* Parent Details */}
                        <section className="card p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center">
                                <FileText className="h-5 w-5 mr-2 text-primary-600" />
                                Parent Contact Information
                            </h3>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Parent Name</p>
                                    <p className="font-medium">{enquiry.parentName}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Mobile Number</p>
                                    <p className="font-medium">+91 {enquiry.mobile}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-gray-500">Email Address</p>
                                    <p className="font-medium">{enquiry.email}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">City</p>
                                    <p className="font-medium">{enquiry.city || 'Not provided'}</p>
                                </div>
                            </div>
                        </section>

                        {/* Additional Information (filtered) */}
                        {enquiry.additionalFields && Object.keys(enquiry.additionalFields).filter(key =>
                            !['_id', 'mobileVerified', 'whatsappSent', 'createdAt', 'updatedAt', '__v', 'waitlist', 'tokenId', 'status', 'slotBookingId'].includes(key)
                        ).length > 0 && (
                                <section className="card p-6 border-l-4 border-blue-200">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center">
                                        Other Information
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                                        {Object.entries(enquiry.additionalFields)
                                            .filter(([key]) => !['_id', 'mobileVerified', 'whatsappSent', 'createdAt', 'updatedAt', '__v', 'waitlist', 'tokenId', 'status', 'slotBookingId'].includes(key))
                                            .map(([key, value]: [string, any]) => (
                                                <div key={key}>
                                                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                                    </p>
                                                    <p className="font-semibold text-gray-800">{value?.toString() || '—'}</p>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </section>
                            )}

                        <section className="card p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center">
                                <CheckCircle className="h-5 w-5 mr-2 text-primary-600" />
                                Admission Process
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 bg-green-100 text-green-600 p-1 rounded-full">
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Enquiry Submitted</p>
                                        <p className="text-sm text-gray-500">Form received and verified via OTP.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className={`mt-1 p-1 rounded-full ${slot ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {slot ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className={`font-bold ${slot ? 'text-gray-900' : 'text-gray-400'}`}>Counselling Session</p>
                                        <p className="text-sm text-gray-500">
                                            {slot ? `Scheduled for ${new Date(slot.date).toLocaleDateString()}.` : 'Awaiting schedule by administration.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className={`mt-1 p-1 rounded-full ${admission?.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {admission?.status === 'approved' ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className={`font-bold ${admission ? 'text-gray-900' : 'text-gray-400'}`}>Admission Confirmation</p>
                                        <p className="text-sm text-gray-500">Final approval after counselling and document verification.</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-8">
                        {/* Slot Info */}
                        {slot && (
                            <section className="card p-6 bg-primary-50 border-primary-100">
                                <h3 className="text-sm font-bold text-primary-800 uppercase tracking-wider mb-4 flex items-center">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Booked Slot
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-primary-600 font-medium">DATE</p>
                                        <p className="text-gray-900 font-bold">{new Date(slot.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-primary-600 font-medium">TIME</p>
                                        <p className="text-gray-900 font-bold">{slot.startTime} - {slot.endTime}</p>
                                    </div>
                                    <div className="pt-3 border-t border-primary-100 text-xs text-primary-700">
                                        <p className="font-medium text-primary-800 mb-1">LOCATION</p>
                                        <p>{slot.location}</p>
                                    </div>

                                    {rescheduleOptions.length > 0 && (
                                        <button
                                            onClick={() => setShowReschedule(true)}
                                            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                                        >
                                            <Clock className="h-3.5 w-3.5" />
                                            Move to Earlier Slot
                                        </button>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* No Slot Booked - Call to Action */}
                        {!slot && admission?.status !== 'waitlisted' && admission?.status !== 'rejected' && (
                            <section className="card p-6 bg-amber-50 border-amber-100">
                                <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-4 flex items-center">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Action Required
                                </h3>
                                <p className="text-sm text-amber-700 mb-6">
                                    Your application has been promoted. Please book a counselling slot to proceed with the admission process.
                                </p>
                                <button
                                    onClick={fetchAvailableSlots}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200"
                                >
                                    <Calendar className="h-4 w-4" />
                                    Book Counselling Slot
                                </button>
                            </section>
                        )}

                        {showBookingModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                                    <h3 className="text-2xl font-black text-gray-900 mb-2">Available Slots</h3>
                                    <p className="text-sm text-gray-500 mb-6">Please select a convenient time for your counselling session.</p>

                                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {availableSlots.length > 0 ? availableSlots.map((opt) => (
                                            <button
                                                key={opt._id}
                                                onClick={() => handleBook(opt._id)}
                                                disabled={booking}
                                                className="w-full p-4 rounded-2xl border-2 border-primary-50 bg-white hover:border-primary-600 transition-all text-left flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-primary-400">{new Date(opt.date).toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                                    <p className="font-bold text-gray-900">{new Date(opt.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                                                    <p className="text-sm font-medium text-primary-600">{opt.startTime} - {opt.endTime}</p>
                                                </div>
                                                <div className="bg-primary-50 p-2 rounded-xl group-hover:bg-primary-600 transition-colors">
                                                    <Calendar className="h-5 w-5 text-primary-600 group-hover:text-white" />
                                                </div>
                                            </button>
                                        )) : (
                                            <p className="text-center py-8 text-gray-500 italic">No slots available at the moment. Please check back later.</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setShowBookingModal(false)}
                                        className="w-full mt-8 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}

                        {showReschedule && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                                    <h3 className="text-2xl font-black text-gray-900 mb-2">Earlier Slots Available</h3>
                                    <p className="text-sm text-gray-500 mb-6"> You can move to slots released after your booking that occur earlier than your current one.</p>

                                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {rescheduleOptions.map((opt) => (
                                            <button
                                                key={opt._id}
                                                onClick={() => handleReschedule(opt._id)}
                                                disabled={rescheduling}
                                                className="w-full p-4 rounded-2xl border-2 border-primary-50 bg-white hover:border-primary-600 transition-all text-left flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-primary-400">{new Date(opt.date).toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                                    <p className="font-bold text-gray-900">{new Date(opt.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                                                    <p className="text-sm font-medium text-primary-600">{opt.startTime} - {opt.endTime}</p>
                                                </div>
                                                <div className="bg-primary-50 p-2 rounded-xl group-hover:bg-primary-600 transition-colors">
                                                    <CheckCircle className="h-5 w-5 text-primary-600 group-hover:text-white" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setShowReschedule(false)}
                                        className="w-full mt-8 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Documents */}
                        <section className="card p-6">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center justify-between">
                                Documents
                                <span className="text-[10px] font-normal text-gray-500 lowercase bg-gray-100 px-2 py-0.5 rounded">
                                    {admission?.documents?.length || 0} / {REQUIRED_DOCUMENTS.length}
                                </span>
                            </h3>

                            <div className="space-y-4">
                                {REQUIRED_DOCUMENTS.map((type) => {
                                    const doc = admission?.documents?.find((d: any) => d.type === type);
                                    const isUploading = uploadLoading === type;

                                    return (
                                        <div key={type} className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className={`font-medium ${doc ? 'text-gray-900' : 'text-gray-500'}`}>{type}</span>
                                                {doc && (
                                                    <span className="text-green-600 flex items-center">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        Uploaded
                                                    </span>
                                                )}
                                            </div>

                                            {doc ? (
                                                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                    <FileText className="h-4 w-4 text-primary-600 shrink-0" />
                                                    <span className="flex-1 truncate text-[10px] text-gray-600">{doc.fileName}</span>
                                                    <div className="flex items-center gap-1">
                                                        <a
                                                            href={doc.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white rounded transition-colors"
                                                            title="View"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDelete(doc._id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                        onChange={(e) => e.target.files?.[0] && handleUpload(type, e.target.files[0])}
                                                        disabled={isUploading}
                                                        accept="image/*,.pdf"
                                                    />
                                                    <div className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg transition-colors ${isUploading ? 'bg-gray-50 border-gray-200' : 'border-gray-100 hover:border-primary-300 hover:bg-primary-50'}`}>
                                                        {isUploading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                                                        ) : (
                                                            <Upload className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                                                            {isUploading ? 'Uploading...' : 'Upload File'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <p className="text-[10px] text-amber-800 leading-relaxed">
                                    <strong>Note:</strong> Please upload clear scans or photos of original documents (Max 5MB each). PDF, JPEG, and PNG supported.
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                confirmText={confirmModal.variant === 'danger' ? 'Delete' : 'Confirm'}
            />
        </div>
    )
}
