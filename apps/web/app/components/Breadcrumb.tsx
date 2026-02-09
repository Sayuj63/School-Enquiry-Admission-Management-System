'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const Breadcrumb = () => {
    const pathname = usePathname()
    // Filter segments, skipping empty and 'admin'
    const segments = pathname.split('/').filter((path) => path && path !== 'admin')

    // Don't show breadcrumb on the main dashboard
    if (pathname === '/admin/dashboard') {
        return null
    }

    // Map of path names to human-readable names
    const routeNameMap: Record<string, string> = {
        dashboard: 'Dashboard',
        enquiries: 'Enquiries',
        admissions: 'Admissions',
        slots: 'Counselling Slots',
        settings: 'Settings',
    }

    const formatPath = (path: string) => {
        const lowerPath = path.toLowerCase()
        if (routeNameMap[lowerPath]) {
            return routeNameMap[lowerPath]
        }

        // Handle IDs or tokens (usually 24 chars for mongo ID or specific token formats)
        if (path.length > 20 && (/\d/.test(path))) {
            return `REF: ${path.substring(0, 8).toUpperCase()}`
        }

        // Return capitalized path with hyphens replaced
        return path.charAt(0).toUpperCase() + path.slice(1).replaceAll('-', ' ')
    }

    return (
        <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-1.5 flex-wrap">
                <li className="flex items-center">
                    <Link
                        href="/admin/dashboard"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-primary-600 hover:border-primary-100 hover:bg-primary-50 transition-all duration-200 group"
                    >
                        <Home className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Portal</span>
                    </Link>
                </li>

                {segments.map((segment, index) => {
                    // Skip dashboard in the list since Portal link already covers it
                    if (segment === 'dashboard') return null

                    const href = `/admin/${segments.slice(0, index + 1).join('/')}`
                    const isLast = index === segments.length - 1
                    const label = formatPath(segment)

                    return (
                        <React.Fragment key={index}>
                            <li className="flex items-center text-gray-300/60" aria-hidden="true">
                                <ChevronRight className="h-3 w-3 stroke-[4px]" />
                            </li>
                            <li className="flex items-center">
                                {isLast ? (
                                    <span className="flex items-center px-4 py-1.5 rounded-xl bg-primary-600 text-white shadow-lg shadow-primary-200/50 text-[10px] font-black uppercase tracking-widest border border-primary-500 animate-in fade-in slide-in-from-left-2 duration-300">
                                        {label}
                                    </span>
                                ) : (
                                    <Link
                                        href={href}
                                        className="flex items-center px-3 py-1.5 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-primary-600 hover:border-primary-100 hover:bg-primary-50 transition-all duration-200 text-[10px] font-black uppercase tracking-widest"
                                    >
                                        {label}
                                    </Link>
                                )}
                            </li>
                        </React.Fragment>
                    )
                })}
            </ol>
        </nav>
    )
}

export default Breadcrumb
