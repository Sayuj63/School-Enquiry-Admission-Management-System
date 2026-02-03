'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, ArrowLeft, Loader2, CheckCircle, UserCircle, Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { sendOTP, verifyOTP, lookupEnquiries } from '@/lib/api'

type Step = 'mobile' | 'otp' | 'loading'

export default function ParentLoginPage() {
    const router = useRouter()
    const [step, setStep] = useState<Step>('mobile')
    const [mobile, setMobile] = useState('')
    const [otp, setOtp] = useState('')
    const [devOtp, setDevOtp] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // Check for existing session
    useEffect(() => {
        const sessionStr = localStorage.getItem('parent_session')
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr)
                const now = new Date().getTime()
                if (session.mobile && session.expires && now < session.expires) {
                    // Smart redirect to avoid flash/history loops
                    lookupEnquiries(session.mobile).then(res => {
                        if (res.success && res.data.enquiries.length > 0) {
                            router.replace('/parent/applications')
                        } else {
                            router.replace('/enquiry')
                        }
                    })
                }
            } catch (e) { }
        }
    }, [router])

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!mobile || mobile.length < 10) {
            setError('Please enter a valid 10-digit mobile number')
            return
        }

        setLoading(true)
        setError('')
        const result = await sendOTP(mobile)
        setLoading(false)

        if (result.success) {
            setStep('otp')
            if (result.data?.otp) {
                setDevOtp(result.data.otp)
            }
        } else {
            setError(result.error || 'Failed to send OTP')
        }
    }

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!otp || otp.length !== 6) {
            setError('Please enter a valid 6-digit OTP')
            return
        }

        setLoading(true)
        setError('')
        const verifyResult = await verifyOTP(mobile, otp)

        if (verifyResult.success) {
            // CREATE PERSISTENT SESSION (20 Minutes)
            const session = {
                mobile: mobile,
                expires: new Date().getTime() + (20 * 60 * 1000)
            }
            localStorage.setItem('parent_session', JSON.stringify(session))

            // Check if user has enquiries
            const enquiriesResult = await lookupEnquiries(mobile)
            if (enquiriesResult.success && enquiriesResult.data.enquiries.length > 0) {
                router.replace('/parent/applications')
            } else {
                router.replace('/enquiry')
            }
        } else {
            setLoading(false)
            setError(verifyResult.error || 'Invalid OTP')
        }
    }

    const startNewEnquiry = () => {
        const session = {
            mobile: mobile,
            expires: new Date().getTime() + (20 * 60 * 1000)
        }
        localStorage.setItem('parent_session', JSON.stringify(session))
        router.push('/enquiry')
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-primary-600 font-bold text-xl">
                        <GraduationCap className="h-8 w-8 mr-2" />
                        ABC School
                    </Link>
                    <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 flex items-center transition-colors">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                    </button>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4 py-12">
                <div className="max-w-md w-full">
                    {step === 'mobile' && (
                        <div className="card p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-primary-50 rounded-full">
                                    <UserCircle className="h-12 w-12 text-primary-600" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Parent Login</h1>
                            <p className="text-center text-gray-600 mb-8">Enter your mobile number to access your applications or start a new enquiry.</p>

                            <form onSubmit={handleSendOTP} className="space-y-6">
                                <div>
                                    <label htmlFor="mobile" className="label">Mobile Number</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Phone className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            id="mobile"
                                            type="tel"
                                            className="input pl-10 h-12 text-lg"
                                            placeholder="98765 43210"
                                            value={mobile}
                                            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            required
                                        />
                                    </div>
                                </div>

                                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={loading || mobile.length < 10}
                                    className="btn-primary w-full h-12 text-lg font-semibold flex items-center justify-center"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'Get OTP'}
                                    {!loading && <ArrowRight className="h-5 w-5 ml-2" />}
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 'otp' && (
                        <div className="card p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Verify OTP</h1>
                            <p className="text-center text-gray-600 mb-6">
                                We've sent a 6-digit code to <span className="font-semibold text-gray-900">+{mobile}</span>
                            </p>

                            {devOtp && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-yellow-800 text-center">
                                        <span className="font-bold">Dev Mode:</span> Your OTP is <span className="font-mono text-lg">{devOtp}</span>
                                    </p>
                                </div>
                            )}

                            <form onSubmit={handleVerifyOTP} className="space-y-6">
                                <div>
                                    <label htmlFor="otp" className="label">6-Digit OTP</label>
                                    <input
                                        id="otp"
                                        type="text"
                                        className="input h-12 text-center text-2xl tracking-[0.5em] font-bold"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        autoFocus
                                        required
                                    />
                                </div>

                                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={loading || otp.length !== 6}
                                    className="btn-primary w-full h-12 text-lg font-semibold flex items-center justify-center"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'Verify & Continue'}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSendOTP}
                                    className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    Resend OTP
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </main>

            <footer className="py-8 bg-white border-t mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
                    <p>© 2026 ABC International School Admissions. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    )
}
