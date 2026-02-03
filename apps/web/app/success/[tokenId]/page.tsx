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
            Back to My Applications
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
          <div className="text-left bg-blue-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              What happens next?
            </h2>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MessageCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">WhatsApp Notification</p>
                  <p className="text-sm text-gray-600">
                    {isWaitlist
                      ? 'You will receive a WhatsApp confirmation of your waitlist status and periodic updates.'
                      : 'You\'ll receive a WhatsApp message with our school brochure and list of required documents.'}
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{isWaitlist ? 'Seat Availability' : 'Counselling Session'}</p>
                  <p className="text-sm text-gray-600">
                    {isWaitlist
                      ? 'Our team will contact you once a seat becomes available for your selected grade.'
                      : 'Our team will contact you to schedule a counselling session with the school.'}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="text-gray-600 mb-8">
            <p>If you have any questions, please contact us:</p>
            <p className="font-medium">
              Email: info@abcschool.com | Phone: +91 98765 43210
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
              Go to My Applications
            </Link>
            <Link href="/" className="text-sm font-medium text-gray-400 hover:text-primary-600">
              Go to Homepage
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
