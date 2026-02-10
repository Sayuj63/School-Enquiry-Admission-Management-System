import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Application Status | Parent Portal',
    description: 'Track your child\'s admission enquiry and admission status',
}

export default function ParentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
