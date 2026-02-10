'use client'

import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'success' | 'warning' | 'info'
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'warning'
}: ConfirmModalProps) {
    if (!isOpen) return null

    const variantStyles = {
        danger: {
            icon: XCircle,
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            confirmBg: 'bg-red-600 hover:bg-red-700 shadow-red-200',
            confirmText: 'text-white'
        },
        success: {
            icon: CheckCircle,
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
            confirmBg: 'bg-green-600 hover:bg-green-700 shadow-green-200',
            confirmText: 'text-white'
        },
        warning: {
            icon: AlertTriangle,
            iconBg: 'bg-yellow-100',
            iconColor: 'text-yellow-600',
            confirmBg: 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200',
            confirmText: 'text-white'
        },
        info: {
            icon: Info,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            confirmBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
            confirmText: 'text-white'
        }
    }

    const style = variantStyles[variant]
    const Icon = style.icon

    const handleConfirm = () => {
        onConfirm()
        onClose()
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-[32px] p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className={`${style.iconBg} p-4 rounded-2xl`}>
                        <Icon className={`h-8 w-8 ${style.iconColor}`} />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-black text-gray-900 tracking-tight text-center mb-3">
                    {title}
                </h3>

                {/* Message */}
                <p className="text-gray-500 text-center font-medium mb-8">
                    {message}
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 border-2 border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 font-bold text-sm transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`flex-1 py-3.5 ${style.confirmBg} ${style.confirmText} rounded-2xl shadow-xl font-bold text-sm transition-all active:scale-95`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
