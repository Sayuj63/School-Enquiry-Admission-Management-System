import Link from 'next/link'
import { GraduationCap, ClipboardList } from 'lucide-react'

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
            New Era High School
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Welcome to our Parent Admission Portal. Start your child&apos;s journey with us today.
          </p>
        </div>

        {/* Portal Options */}
        <div className="max-w-xl mx-auto">
          {/* Parent Portal */}
          <Link href="/parent/login" className="block">
            <div className="card h-full hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer p-8 group border-2 border-primary-200 hover:border-primary-500 bg-white rounded-3xl">
              <div className="flex items-center mb-6">
                <div className="p-4 bg-primary-100 rounded-2xl group-hover:bg-primary-600 group-hover:text-white transition-all">
                  <ClipboardList className="h-8 w-8 text-primary-600 group-hover:text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 ml-4">
                  Parent Portal
                </h2>
              </div>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Start a new enquiry for your child or view your existing applications. Fast and secure OTP-based access.
              </p>
              <div className="flex items-center text-primary-600 font-bold text-lg mt-auto">
                Enquire Now
                <span className="ml-2 group-hover:translate-x-2 transition-transform">&rarr;</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>Contact us: admissions@nes.edu.in | +91 98765 43210</p>
        </div>
      </div>
    </div>
  )
}

