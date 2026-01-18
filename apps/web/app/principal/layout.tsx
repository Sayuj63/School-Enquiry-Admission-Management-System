'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
    GraduationCap,
    LayoutDashboard,
    ClipboardList,
    FileText,
    Calendar,
    LogOut,
    Menu,
    X
} from 'lucide-react'
import { getCurrentUser, logout } from '@/lib/api'

const navigation = [
    { name: 'Dashboard', href: '/principal/dashboard', icon: LayoutDashboard },
    { name: 'Admissions', href: '/principal/admissions', icon: FileText },
    { name: 'Calendar', href: '/principal/calendar', icon: Calendar },
]

export default function PrincipalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Skip auth check for login page
    const isLoginPage = pathname === '/principal/login'

    useEffect(() => {
        if (isLoginPage) {
            setLoading(false)
            return
        }

        async function checkAuth() {
            const result = await getCurrentUser()
            if (result.success && result.data) {
                setUser(result.data)
                // Verify user is principal
                if (result.data.username?.toLowerCase() !== 'principal') {
                    router.push('/admin/dashboard')
                }
            } else {
                router.push('/admin/login')
            }
            setLoading(false)
        }

        checkAuth()
    }, [isLoginPage, router])

    const handleLogout = () => {
        logout()
        router.push('/admin/login')
    }

    // Show only children for login page
    if (isLoginPage) {
        return <>{children}</>
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-4 border-b">
                        <Link href="/principal/dashboard" className="flex items-center hover:opacity-80 transition-opacity">
                            <GraduationCap className="h-8 w-8 text-primary-600" />
                            <span className="ml-2 text-lg font-semibold text-gray-900">
                                Principal Portal
                            </span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden text-gray-500 hover:text-gray-700"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-2 py-4 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User info & Logout */}
                    <div className="border-t p-4">
                        <div className="flex items-center mb-3">
                            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary-700">
                                    {user.username?.charAt(0).toUpperCase() || 'P'}
                                </span>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                            <LogOut className="h-5 w-5 mr-3" />
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Top bar */}
                <header className="bg-white shadow-sm h-16 flex items-center px-4 lg:px-8">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-gray-500 hover:text-gray-700 mr-4"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">
                        {navigation.find((item) => item.href === pathname)?.name || 'Principal'}
                    </h1>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
