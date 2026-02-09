'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, MessageCircle, FileText, ArrowLeft, Home } from 'lucide-react'

function SuccessContent() {
  const router = useRouter()
  const params = useParams()
  const tokenId = params.tokenId as string

  const searchParams = useSearchParams()
  const isWaitlist = searchParams.get('waitlist') === 'true'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/parent/applications" className="inline-flex items-center text-sm font-bold text-green-700 hover:text-green-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Application Status
          </Link>
        </div>
        <div className="card text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {isWaitlist ? 'Waitlist Joined Successfully' : 'Thank You for Your Interest!'}
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            {isWaitlist
              ? 'Your application has been added to our waitlist.'
              : 'Your enquiry has been submitted successfully.'}
          </p>

          {/* Token ID */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <p className="text-sm text-gray-500 mb-2">Your Enquiry Token ID</p>
            <p className="text-2xl font-mono font-bold text-primary-600">
              {tokenId}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please keep this for future reference
            </p>
          </div>

          {/* What's Next */}
          <div className="text-left bg-white border border-blue-100/50 rounded-[32px] p-8 mb-8 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <MessageCircle className="h-5 w-5" />
              </div>
              What Happens Next?
            </h2>

            <div className="space-y-8 relative">
              <div className="absolute left-6 top-1 bottom-8 w-px bg-gradient-to-b from-blue-100 to-transparent"></div>

              <div className="relative flex items-start gap-6 group">
                <div className="w-12 h-12 rounded-2xl bg-white border-4 border-blue-50 shadow-sm flex items-center justify-center shrink-0 z-10 group-hover:border-blue-100 transition-colors">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="pt-1">
                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">WhatsApp Confirmation</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {isWaitlist
                      ? 'You will receive a WhatsApp confirmation of your waitlist status and periodic updates regarding seat availability.'
                      : 'You\'ll receive a WhatsApp message with our school brochure and a detailed checklist of required documents.'}
                  </p>
                </div>
              </div>

              <div className="relative flex items-start gap-6 group">
                <div className="w-12 h-12 rounded-2xl bg-white border-4 border-blue-50 shadow-sm flex items-center justify-center shrink-0 z-10 group-hover:border-blue-100 transition-colors">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="pt-1">
                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{isWaitlist ? 'Waitlist Registry' : 'Next Steps'}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {isWaitlist
                      ? 'Our team will contact you directly as soon as a seat becomes available for your selected grade.'
                      : 'Our admissions team will review your enquiry. We recommend uploading mandatory documents via the Parent Portal to expedite your visit.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="text-gray-600 mb-8">
            <p>If you have any questions, please contact us:</p>
            <p className="font-medium">
              Email: <a href="mailto:info@nes.edu.in" className="text-primary-600 hover:underline">info@nes.edu.in</a> |
              Phone: <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline ml-1">+91 98765 43210</a>
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link href={`/parent/enquiry/${tokenId}`} className="btn-primary px-8">
              <FileText className="h-4 w-4 mr-2" />
              View Application Status
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
            <Link href="/parent/applications" className="text-sm font-medium text-gray-400 hover:text-primary-600">
              Go to Application Status
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
