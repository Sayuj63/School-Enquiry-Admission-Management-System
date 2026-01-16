import Link from 'next/link'
import { GraduationCap, ClipboardList, UserCircle, Shield } from 'lucide-react'

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

        {/* Center Login Card */}
        <div className="flex justify-center max-w-xl mx-auto">
          <Link href="/admin/login" className="block w-full">
            <div className="card hover:shadow-xl transition-all cursor-pointer p-8 group">
              <div className="flex items-center mb-6">
                <div className="p-3 bg-primary-50 rounded-lg group-hover:bg-primary-100 transition-colors">
                  <UserCircle className="h-10 w-10 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 ml-4">
                  Staff Portal
                </h2>
              </div>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Log in to access the School Admission Management System. Manage enquiries, admissions, and counselling schedules in one place.
              </p>
              <div className="flex items-center text-primary-600 font-semibold text-lg">
                Proceed to Login
                <span className="ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
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
