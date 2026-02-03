'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface PromptModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (value: string) => void
    title: string
    message: string
    placeholder?: string
    confirmText?: string
    cancelText?: string
}

export default function PromptModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    placeholder = '',
    confirmText = 'Submit',
    cancelText = 'Cancel'
}: PromptModalProps) {
    const [inputValue, setInputValue] = useState('')

    if (!isOpen) return null

    const handleConfirm = () => {
        if (inputValue.trim()) {
            onConfirm(inputValue)
            setInputValue('')
            onClose()
        }
    }

    const handleClose = () => {
        setInputValue('')
        onClose()
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            handleConfirm()
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-[32px] p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-center mb-6">
                    <div className="bg-red-100 p-4 rounded-2xl">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                </div>

                <h3 className="text-2xl font-black text-gray-900 tracking-tight text-center mb-3">
                    {title}
                </h3>

                <p className="text-gray-500 text-center font-medium mb-6">
                    {message}
                </p>

                <div className="mb-8">
                    <textarea
                        autoFocus
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-red-400 focus:ring-0 outline-none transition-colors resize-none font-medium text-gray-900 placeholder:text-gray-400"
                        rows={4}
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-3.5 border-2 border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 font-bold text-sm transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!inputValue.trim()}
                        className={`flex-1 py-3.5 rounded-2xl shadow-xl font-bold text-sm transition-all active:scale-95 ${inputValue.trim()
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
