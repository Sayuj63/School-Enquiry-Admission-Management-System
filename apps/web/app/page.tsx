import Link from 'next/link'
import { GraduationCap, ClipboardList, UserCircle } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <GraduationCap className="h-16 w-16 text-primary-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ABC International School
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Welcome to our School Admission Portal. Start your child&apos;s journey with us today.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Enquiry Card */}
          <Link href="/enquiry" className="block">
            <div className="card hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="flex items-center mb-4">
                <ClipboardList className="h-10 w-10 text-primary-600" />
                <h2 className="text-2xl font-semibold text-gray-900 ml-3">
                  Submit Enquiry
                </h2>
              </div>
              <p className="text-gray-600 mb-4">
                Interested in admission? Fill out our enquiry form and our team will get back to you shortly.
              </p>
              <span className="text-primary-600 font-medium">
                Start Enquiry &rarr;
              </span>
            </div>
          </Link>

          {/* Admin Card */}
          <Link href="/admin/login" className="block">
            <div className="card hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="flex items-center mb-4">
                <UserCircle className="h-10 w-10 text-primary-600" />
                <h2 className="text-2xl font-semibold text-gray-900 ml-3">
                  Admin Portal
                </h2>
              </div>
              <p className="text-gray-600 mb-4">
                School administrators can manage enquiries, admissions, and counselling slots.
              </p>
              <span className="text-primary-600 font-medium">
                Admin Login &rarr;
              </span>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>Contact us: info@abcschool.com | +91 98765 43210</p>
        </div>
      </div>
    </div>
  )
}
