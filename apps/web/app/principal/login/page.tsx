'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { GraduationCap, Loader2, ArrowLeft, Shield } from 'lucide-react'
import { login } from '@/lib/api'

interface LoginFormData {
    email: string
    password: string
}

export default function PrincipalLoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<LoginFormData>()

    const onSubmit = async (data: LoginFormData) => {
        setLoading(true)
        setError('')

        const result = await login(data.email, data.password)

        setLoading(false)

        if (result.success) {
            // Store user data for role-based UI
            if (result.data?.user) {
                localStorage.setItem('user_data', JSON.stringify(result.data.user))
            }

            // Check if user is principal
            const userRole = result.data?.user?.username?.toLowerCase()
            if (userRole === 'principal') {
                router.push('/principal/dashboard')
            } else {
                setError('Access denied. Principal credentials required.')
            }
        } else {
            setError(result.error || 'Login failed')
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full">
                <div className="mb-6">
                    <button onClick={() => router.back()} className="inline-flex items-center text-primary-600 hover:text-primary-700 transition-colors">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                    </button>
                </div>

                <div className="card">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Shield className="h-12 w-12 text-primary-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Principal Portal
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Sign in to view counselling schedules
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="label">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                className={`input ${errors.email ? 'input-error' : ''}`}
                                placeholder="principal@school.com"
                                {...register('email', {
                                    required: 'Email is required',
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: 'Invalid email address'
                                    }
                                })}
                            />
                            {errors.email && (
                                <p className="error-text">{errors.email.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                className={`input ${errors.password ? 'input-error' : ''}`}
                                placeholder="Enter your password"
                                {...register('password', {
                                    required: 'Password is required'
                                })}
                            />
                            {errors.password && (
                                <p className="error-text">{errors.password.message}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="btn-primary w-full py-3"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Dev Mode Hint */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-xs text-gray-500 text-center">
                            Default credentials: principal@school.com / principal123
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
