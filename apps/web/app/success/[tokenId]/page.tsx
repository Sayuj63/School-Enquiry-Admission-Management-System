'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle, MessageCircle, FileText, ArrowLeft, Home } from 'lucide-react'

export default function SuccessPage() {
  const params = useParams()
  const tokenId = params.tokenId as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Thank You for Your Interest!
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            Your enquiry has been submitted successfully.
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
                  <p className="font-medium text-gray-900">WhatsApp Message</p>
                  <p className="text-sm text-gray-600">
                    You&apos;ll receive a WhatsApp message with our school brochure and list of required documents.
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Counselling Session</p>
                  <p className="text-sm text-gray-600">
                    Our team will contact you to schedule a counselling session with the school.
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/enquiry" className="btn-secondary">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Submit Another Enquiry
            </Link>
            <Link href="/" className="btn-primary">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
