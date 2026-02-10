'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, LogOut, Loader2, ArrowRight, PlusCircle, FileText, ChevronRight, User } from 'lucide-react'
import Link from 'next/link'
import { lookupEnquiries } from '@/lib/api'


interface EnquirySummary {
    _id: string
    tokenId?: string
    childName: string
    grade: string
    status: string
    createdAt: string
}

export default function parentApplicationsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [mobile, setMobile] = useState('')
    const [enquiries, setEnquiries] = useState<EnquirySummary[]>([])
    const [error, setError] = useState('')

    useEffect(() => {
        const sessionStr = localStorage.getItem('parent_session')
        if (!sessionStr) {
            router.push('/parent/login')
            return
        }

        try {
            const session = JSON.parse(sessionStr)
            const now = new Date().getTime()
            if (!session.mobile || !session.expires || now > session.expires) {
                localStorage.removeItem('parent_session')
                router.push('/parent/login')
                return
            }

            setMobile(session.mobile)
            fetchEnquiries(session.mobile)
        } catch (e) {
            localStorage.removeItem('parent_session')
            router.push('/parent/login')
        }
    }, [router])

    const fetchEnquiries = async (mobileNum: string) => {
        setLoading(true)
        const result = await lookupEnquiries(mobileNum)
        if (result.success) {
            const userEnquiries = result.data.enquiries
            if (userEnquiries.length === 0) {
                router.replace('/enquiry')
                return
            }
            setEnquiries(userEnquiries)
        } else {
            // If it's an authentication/verification error, just go back to login instead of showing an "error"
            if (result.error === 'Mobile number not verified' || result.error === 'Unauthorized') {
                localStorage.removeItem('parent_session')
                router.replace('/parent/login')
                return
            }
            setError('Failed to load your applications.')
        }
        setLoading(false)
    }

    const handleLogout = () => {
        localStorage.removeItem('parent_session')
        localStorage.removeItem('parent_mobile_verified')
        router.push('/parent/login')
    }

    const startNewEnquiry = () => {
        router.push('/enquiry')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center text-primary-600 font-black text-2xl tracking-tight select-none">
                        <GraduationCap className="h-10 w-10 mr-2" />
                        New Era High School
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center text-sm font-bold text-red-500 hover:text-red-600 transition-all bg-white px-4 py-2 rounded-xl border border-red-50 shadow-sm hover:shadow-md active:scale-95"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Log out
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-4xl w-full mx-auto p-4 py-12">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-2xl mb-4">
                        <User className="h-8 w-8 text-primary-600" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2">Application Status</h1>
                    <p className="text-gray-500 font-medium">Manage enquiries for mobile number <span className="text-gray-900 font-bold">+91 {mobile}</span></p>
                </div>

                {enquiries.length > 0 ? (
                    <div className="space-y-6">
                        <div className="grid gap-4">
                            {enquiries.map((enq) => (
                                <div
                                    key={enq._id}
                                    className="group bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-primary-100/20 hover:border-primary-200 transition-all cursor-pointer"
                                    onClick={() => {
                                        if (enq.status === 'draft') {
                                            router.push(`/enquiry?resume=${enq._id}`)
                                        } else {
                                            router.push(`/parent/enquiry/${enq.tokenId}`)
                                        }
                                    }}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                                                <FileText className="h-7 w-7 text-gray-400 group-hover:text-primary-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{enq.childName}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-sm font-bold text-gray-400">{enq.grade}</span>
                                                    <span className="text-gray-200">•</span>
                                                    <span className="text-xs font-mono text-gray-400">{enq.tokenId || 'ID: Draft'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between md:justify-end gap-6">
                                            <div className="text-right">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${enq.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                                                    enq.status === 'token_number_generated' ? 'bg-blue-100 text-blue-700' :
                                                        enq.status === 'converted' ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {enq.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                                </span>
                                                <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase tracking-tighter">
                                                    {new Date(enq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-6 w-6 text-gray-200 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-8">
                            <button
                                onClick={startNewEnquiry}
                                className="w-full group relative overflow-hidden bg-primary-600 hover:bg-primary-700 text-white rounded-[24px] p-8 transition-all hover:shadow-2xl hover:shadow-primary-200 active:scale-[0.98]"
                            >
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="text-left">
                                        <h3 className="text-2xl font-black mb-1">Apply for another child</h3>
                                        <p className="text-primary-100 font-medium">Start a fresh admission enquiry for a sibling</p>
                                    </div>
                                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                                        <PlusCircle className="h-8 w-8" />
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto">
                        <div className="bg-white p-10 rounded-[32px] border border-gray-100 shadow-xl text-center">
                            <div className="w-20 h-20 bg-primary-50 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                                <PlusCircle className="h-10 w-10 text-primary-600" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2">No Applications Found</h2>
                            <p className="text-gray-500 font-medium mb-8">Start your child's journey with us by filling out the admission enquiry form.</p>
                            <button
                                onClick={startNewEnquiry}
                                className="btn-primary w-full h-14 text-lg font-black rounded-2xl flex items-center justify-center gap-2 group"
                            >
                                Create New Application
                                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-center font-bold">
                        {error}
                    </div>
                )}
            </main>

            <footer className="py-12 bg-white border-t mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">© 2026 New Era High School</p>
                </div>
            </footer>
        </div>
    )
}
