'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Loader2, GripVertical, CheckSquare, Square } from 'lucide-react'
import {
  getEnquiryTemplate,
  updateEnquiryTemplate,
  getAdmissionTemplate,
  updateAdmissionTemplate,
  getDocumentsList,
  updateDocumentsList,
  getNotificationSettings,
  updateNotificationSettings,
  getSlotSettings,
  updateSlotSettings,
  getGradeRules,
  updateGradeRules,
  exportAdmissions,
  resetAdmissionCycle
} from '@/lib/api'
import ConfirmModal from '@/app/components/ConfirmModal'

interface FormField {
  name: string
  label: string
  type: string
  required: boolean
  options?: string[]
  order: number
  placeholder?: string
}

interface RequiredDocument {
  name: string
  required: boolean
  order: number
}

const ADMISSION_BASE_FIELDS = [
  { name: 'studentName', label: 'Student Name' },
  { name: 'parentName', label: 'Parent Name' },
  { name: 'mobile', label: 'Mobile Number' },
  { name: 'email', label: 'Email Address' },
  { name: 'city', label: 'City' },
  { name: 'grade', label: 'Grade/Class' }
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'enquiry' | 'admission' | 'documents' | 'notifications' | 'slots' | 'grades' | 'maintenance'>('enquiry')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [enquiryFields, setEnquiryFields] = useState<FormField[]>([])
  const [initialEnquiryFields, setInitialEnquiryFields] = useState<FormField[]>([])

  const [admissionFields, setAdmissionFields] = useState<FormField[]>([])
  const [initialAdmissionFields, setInitialAdmissionFields] = useState<FormField[]>([])

  const [admissionBaseFields, setAdmissionBaseFields] = useState<Record<string, boolean>>({
    studentName: true,
    parentName: true,
    mobile: true,
    email: true,
    city: true,
    grade: true
  })
  const [initialAdmissionBaseFields, setInitialAdmissionBaseFields] = useState<Record<string, boolean>>({
    studentName: true,
    parentName: true,
    mobile: true,
    email: true,
    city: true,
    grade: true
  })

  const [documents, setDocuments] = useState<RequiredDocument[]>([])
  const [initialDocuments, setInitialDocuments] = useState<RequiredDocument[]>([])

  const [notificationSettings, setNotificationSettings] = useState<any>(null)
  const [initialNotificationSettings, setInitialNotificationSettings] = useState<any>(null)

  const [slotSettings, setSlotSettings] = useState<any>(null)
  const [initialSlotSettings, setInitialSlotSettings] = useState<any>(null)

  const [gradeRules, setGradeRules] = useState<any[]>([])
  const [initialGradeRules, setInitialGradeRules] = useState<any[]>([])
  const [gradeSettings, setGradeSettings] = useState<any>(null)
  const [initialGradeSettings, setInitialGradeSettings] = useState<any>(null)

  const [resetCredentials, setResetCredentials] = useState({ principalEmail: '', principalPassword: '' })
  const [isExported, setIsExported] = useState(false)

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [currentAddType, setCurrentAddType] = useState<'enquiry' | 'admission'>('enquiry')
  const [newFieldData, setNewFieldData] = useState({ label: '', type: 'text' })
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } })

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-clear alerts after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const fetchData = async () => {
    setLoading(true)

    const [enquiryResult, admissionResult, docsResult] = await Promise.all([
      getEnquiryTemplate(),
      getAdmissionTemplate(),
      getDocumentsList()
    ])

    if (enquiryResult.success && enquiryResult.data) {
      setEnquiryFields(enquiryResult.data.fields || [])
      setInitialEnquiryFields(enquiryResult.data.fields || [])
    }

    if (admissionResult.success && admissionResult.data) {
      setAdmissionFields(admissionResult.data.fields || [])
      setInitialAdmissionFields(admissionResult.data.fields || [])

      if (admissionResult.data.baseFields) {
        const bf = admissionResult.data.baseFields
        const newBaseFields = (prev: Record<string, boolean>) => ({
          ...prev,
          ...(bf instanceof Map ? Object.fromEntries(bf) : bf)
        })
        setAdmissionBaseFields(newBaseFields)
        // We need the computed value for initial state
        setAdmissionBaseFields(prev => {
          setInitialAdmissionBaseFields(prev)
          return prev
        })
      }
    }

    if (docsResult.success && docsResult.data) {
      setDocuments(docsResult.data.documents || [])
      setInitialDocuments(docsResult.data.documents || [])
    }

    const notifResult = await getNotificationSettings()
    if (notifResult.success) {
      setNotificationSettings(notifResult.data)
      setInitialNotificationSettings(notifResult.data)
    }

    const slotResult = await getSlotSettings()
    if (slotResult.success) {
      setSlotSettings(slotResult.data)
      setInitialSlotSettings(slotResult.data)
    }

    const gradeResult = await getGradeRules()
    if (gradeResult.success) {
      setGradeRules(gradeResult.data.rules)
      setInitialGradeRules(gradeResult.data.rules)
      setGradeSettings(gradeResult.data.settings)
      setInitialGradeSettings(gradeResult.data.settings)
    }

    setLoading(false)
  }

  const handleSaveEnquiry = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateEnquiryTemplate(enquiryFields)

    if (result.success) {
      setSuccess('Enquiry template saved successfully')
      setInitialEnquiryFields(enquiryFields)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleSaveAdmission = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateAdmissionTemplate(admissionFields, admissionBaseFields)

    if (result.success) {
      setSuccess('Admission template saved successfully')
      setInitialAdmissionFields(admissionFields)
      setInitialAdmissionBaseFields(admissionBaseFields)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleSaveDocuments = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateDocumentsList(documents)

    if (result.success) {
      setSuccess('Documents list saved successfully')
      setInitialDocuments(documents)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateNotificationSettings(notificationSettings)

    if (result.success) {
      setSuccess('Notification settings saved successfully')
      setInitialNotificationSettings(notificationSettings)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleSaveSlotSettings = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateSlotSettings(slotSettings)

    if (result.success) {
      setSuccess('Slot settings saved successfully')
      setInitialSlotSettings(slotSettings)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleSaveGradeRules = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const result = await updateGradeRules({ rules: gradeRules, settings: gradeSettings })

    if (result.success) {
      setSuccess('Grade rules and seat availability saved')
      setInitialGradeRules(gradeRules)
      setInitialGradeSettings(gradeSettings)
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const handleExport = async () => {
    try {
      setSaving(true)
      const blob = await exportAdmissions()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `admissions_export_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      setIsExported(true)
      setSuccess('Export successful. You can now proceed with cycle reset if needed.')
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!isExported) {
      setError('Please download the Excel export before resetting the cycle.')
      return
    }

    setConfirmModal({
      isOpen: true,
      title: 'CRITICAL: Reset Admission Cycle',
      message: 'This will delete ALL enquiries, admissions, and slots. This action cannot be undone. Are you absolutely sure?',
      onConfirm: async () => {
        setSaving(true)
        setError('')
        setSuccess('')

        const result = await resetAdmissionCycle(resetCredentials)

        if (result.success) {
          setSuccess('Admission cycle has been reset successfully.')
          setResetCredentials({ principalEmail: '', principalPassword: '' })
          fetchData()
        } else {
          setError(result.error || 'Reset failed. Please check principal credentials.')
        }

        setSaving(false)
      }
    })
  }

  const openAddModal = (type: 'enquiry' | 'admission') => {
    setCurrentAddType(type)
    setNewFieldData({ label: '', type: 'text' })
    setIsAddModalOpen(true)
  }

  const handleAddField = () => {
    if (!newFieldData.label.trim()) return

    const newField: FormField = {
      name: `field_${Date.now()}`,
      label: newFieldData.label,
      type: newFieldData.type,
      required: false,
      order: currentAddType === 'enquiry' ? enquiryFields.length : admissionFields.length
    }

    if (currentAddType === 'enquiry') {
      setEnquiryFields([...enquiryFields, newField])
    } else {
      setAdmissionFields([...admissionFields, newField])
    }
    setIsAddModalOpen(false)
  }

  const updateField = (type: 'enquiry' | 'admission', index: number, updates: Partial<FormField>) => {
    if (type === 'enquiry') {
      const updated = [...enquiryFields]
      updated[index] = { ...updated[index], ...updates }
      setEnquiryFields(updated)
    } else {
      const updated = [...admissionFields]
      updated[index] = { ...updated[index], ...updates }
      setAdmissionFields(updated)
    }
  }

  const removeField = (type: 'enquiry' | 'admission', index: number) => {
    if (type === 'enquiry') {
      setEnquiryFields(enquiryFields.filter((_, i) => i !== index))
    } else {
      setAdmissionFields(admissionFields.filter((_, i) => i !== index))
    }
  }

  const toggleAdmissionBaseField = (fieldName: string) => {
    setAdmissionBaseFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  const addDocument = () => {
    setDocuments([
      ...documents,
      { name: 'New Document', required: true, order: documents.length }
    ])
  }

  const updateDocument = (index: number, updates: Partial<RequiredDocument>) => {
    const updated = [...documents]
    updated[index] = { ...updated[index], ...updates }
    setDocuments(updated)
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  const tabs = [
    { id: 'enquiry', label: 'Enquiry Form' },
    { id: 'admission', label: 'Admission Form' },
    { id: 'documents', label: 'Required Documents' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'slots', label: 'Slot Rules' },
    { id: 'grades', label: 'Grade & Seats' },
    { id: 'maintenance', label: 'Maintenance' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600">Manage form templates and required documents</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded p-3">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Enquiry Form Tab */}
      {activeTab === 'enquiry' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Enquiry Form Fields</h3>
            <div className="flex gap-3">
              <button onClick={() => openAddModal('enquiry')} className="btn-secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </button>
              <button
                onClick={handleSaveEnquiry}
                disabled={saving || JSON.stringify(enquiryFields) === JSON.stringify(initialEnquiryFields)}
                className={`btn-primary transition-all ${JSON.stringify(enquiryFields) === JSON.stringify(initialEnquiryFields) ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 opacity-70' : ''}`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {enquiryFields.map((field, index) => (
              <div key={index} className="flex flex-col gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="text-gray-400 cursor-move pt-2">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 grid sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      className="input"
                      placeholder="Label"
                      value={field.label}
                      onChange={(e) => updateField('enquiry', index, { label: e.target.value })}
                    />
                    <select
                      className="input"
                      value={field.type}
                      onChange={(e) => updateField('enquiry', index, { type: e.target.value })}
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="select">List</option>
                      <option value="textarea">Textarea</option>
                      <option value="date">Date</option>
                      <option value="number">Number</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={field.required}
                        onChange={(e) => updateField('enquiry', index, { required: e.target.checked })}
                      />
                      <span className="ml-2 text-sm whitespace-nowrap">Required</span>
                    </label>
                    <button
                      onClick={() => removeField('enquiry', index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {field.type === 'select' && (
                  <div className="pl-9">
                    <input
                      type="text"
                      className="input w-full bg-white"
                      placeholder="Options (comma separated, e.g. Nursery, LKG, UKG)"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => updateField('enquiry', index, {
                        options: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                      })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admission Form Tab */}
      {activeTab === 'admission' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Admission Setup</h2>
              <p className="text-gray-500 text-sm">Configure fields for the admission application form</p>
            </div>
            <button
              onClick={handleSaveAdmission}
              disabled={saving || (JSON.stringify(admissionFields) === JSON.stringify(initialAdmissionFields) && JSON.stringify(admissionBaseFields) === JSON.stringify(initialAdmissionBaseFields))}
              className={`btn-primary transition-all ${(JSON.stringify(admissionFields) === JSON.stringify(initialAdmissionFields) && JSON.stringify(admissionBaseFields) === JSON.stringify(initialAdmissionBaseFields))
                ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 opacity-70'
                : ''
                }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </button>
          </div>

          {/* Base Fields Visibility */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Base Fields Visibility</h3>
              <p className="text-sm text-gray-500 italic">Toggle visibility of auto-filled fields</p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {ADMISSION_BASE_FIELDS.map((field) => (
                <button
                  key={field.name}
                  onClick={() => toggleAdmissionBaseField(field.name)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${admissionBaseFields[field.name]
                    ? 'bg-primary-50 border-primary-200 text-primary-900 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-500 grayscale'
                    }`}
                >
                  {admissionBaseFields[field.name] ? (
                    <CheckSquare className="h-5 w-5 text-primary-600" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="font-medium">{field.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Additional Form Fields</h3>
              <div className="flex gap-3">
                <button onClick={() => openAddModal('admission')} className="btn-secondary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </button>
              </div>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Basic fields (Student Name, Parent Name, Mobile, Email, Grade) are automatically pre-filled from the enquiry.
                Add additional fields that admin needs to fill.
              </p>
            </div>

            <div className="space-y-4">
              {admissionFields.map((field, index) => (
                <div key={index} className="flex flex-col gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="text-gray-400 cursor-move pt-2">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 grid sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        className="input"
                        placeholder="Label"
                        value={field.label}
                        onChange={(e) => updateField('admission', index, { label: e.target.value })}
                      />
                      <select
                        className="input"
                        value={field.type}
                        onChange={(e) => updateField('admission', index, { type: e.target.value })}
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                        <option value="select">Select</option>
                        <option value="textarea">Textarea</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={field.required}
                          onChange={(e) => updateField('admission', index, { required: e.target.checked })}
                        />
                        <span className="ml-2 text-sm whitespace-nowrap">Required</span>
                      </label>
                      <button
                        onClick={() => removeField('admission', index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {field.type === 'select' && (
                    <div className="pl-9">
                      <input
                        type="text"
                        className="input w-full bg-white"
                        placeholder="Options (comma separated, e.g. A+, B+, AB+)"
                        value={field.options?.join(', ') || ''}
                        onChange={(e) => updateField('admission', index, {
                          options: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                        })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Required Documents</h3>
            <div className="flex gap-3">
              <button onClick={addDocument} className="btn-secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </button>
              <button
                onClick={handleSaveDocuments}
                disabled={saving || JSON.stringify(documents) === JSON.stringify(initialDocuments)}
                className={`btn-primary transition-all ${JSON.stringify(documents) === JSON.stringify(initialDocuments) ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 opacity-70' : ''}`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </button>
            </div>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              This list is sent to parents via WhatsApp after enquiry submission.
            </p>
          </div>

          <div className="space-y-3">
            {documents.map((doc, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-gray-400 cursor-move">
                  <GripVertical className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Document Name"
                  value={doc.name}
                  onChange={(e) => updateDocument(index, { name: e.target.value })}
                />
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={doc.required}
                    onChange={(e) => updateDocument(index, { required: e.target.checked })}
                  />
                  <span className="ml-2 text-sm whitespace-nowrap">Required</span>
                </label>
                <button
                  onClick={() => removeDocument(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && notificationSettings && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">WhatsApp & Notification Settings</h3>
            <button
              onClick={handleSaveNotifications}
              disabled={saving || JSON.stringify(notificationSettings) === JSON.stringify(initialNotificationSettings)}
              className={`btn-primary transition-all ${JSON.stringify(notificationSettings) === JSON.stringify(initialNotificationSettings) ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 opacity-70' : ''}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="label">WhatsApp Provider</label>
                <select
                  className="input"
                  value={notificationSettings.whatsappProvider}
                  onChange={e => setNotificationSettings({ ...notificationSettings, whatsappProvider: e.target.value })}
                >
                  <option value="mock">Mock Console (Development)</option>
                  <option value="twilio">Twilio WhatsApp</option>
                  <option value="interakt">Interakt (BETA)</option>
                </select>
              </div>
              <div className="flex items-center pt-8">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={notificationSettings.whatsappEnabled}
                      onChange={e => setNotificationSettings({ ...notificationSettings, whatsappEnabled: e.target.checked })}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${notificationSettings.whatsappEnabled ? 'bg-primary-600' : 'bg-gray-400'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${notificationSettings.whatsappEnabled ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className="ml-3 font-medium text-gray-900">Enable WhatsApp Notifications</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Counselling Reminders</h4>
              <p className="text-sm text-gray-500 mb-4">Select days prior to counselling for automated WhatsApp reminders</p>

              <div className="flex flex-wrap gap-4">
                {[1, 2, 3, 5, 7].map(day => (
                  <button
                    key={day}
                    onClick={() => {
                      const days = [...notificationSettings.reminderDays];
                      if (days.includes(day)) {
                        setNotificationSettings({ ...notificationSettings, reminderDays: days.filter(d => d !== day) });
                      } else {
                        setNotificationSettings({ ...notificationSettings, reminderDays: [...days, day].sort() });
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border transition-all font-medium ${notificationSettings.reminderDays.includes(day)
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    T-{day} Day{day > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Waitlist Reminders</h4>
              <p className="text-sm text-gray-500 mb-4">Automated reminders sent to parents on waitlist at T + (Selected Days)</p>

              <div className="flex flex-wrap gap-4 mb-4">
                {[2, 5, 7, 10, 15].map(day => (
                  <button
                    key={day}
                    onClick={() => {
                      const days = [...(notificationSettings.waitlistReminderDays || [])];
                      if (days.includes(day)) {
                        setNotificationSettings({ ...notificationSettings, waitlistReminderDays: days.filter(d => d !== day) });
                      } else {
                        setNotificationSettings({ ...notificationSettings, waitlistReminderDays: [...days, day].sort() });
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border transition-all font-medium ${notificationSettings.waitlistReminderDays?.includes(day)
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    T+{day} Day{day > 1 ? 's' : ''}
                  </button>
                ))}
              </div>

              <label className="label">Waitlist Reminder Template</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="Hello! This is a reminder for childName..."
                value={notificationSettings.waitlistReminderTemplate || ''}
                onChange={e => setNotificationSettings({ ...notificationSettings, waitlistReminderTemplate: e.target.value })}
              />
              <p className="text-[10px] text-gray-400 mt-1">Use <strong>childName</strong> and <strong>tokenId</strong> as placeholders.</p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="label">School Brochure URL</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="https://your-school.com/brochure.pdf"
                  value={notificationSettings.brochureUrl}
                  onChange={e => setNotificationSettings({ ...notificationSettings, brochureUrl: e.target.value })}
                />
                <a href={notificationSettings.brochureUrl} target="_blank" rel="noreferrer" className="btn-secondary px-3">
                  Test
                </a>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">This link is sent to parents immediately after they submit an enquiry.</p>
            </div>
          </div>
        </div>
      )}

      {/* Slot Rules Tab */}
      {activeTab === 'slots' && slotSettings && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Slot Rules & Configuration</h3>
            <button
              onClick={handleSaveSlotSettings}
              disabled={saving || JSON.stringify(slotSettings) === JSON.stringify(initialSlotSettings)}
              className={`btn-primary transition-all ${JSON.stringify(slotSettings) === JSON.stringify(initialSlotSettings) ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 opacity-70' : ''}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="label">Slot Duration (Minutes)</label>
              <input
                type="number"
                className="input"
                value={slotSettings.slotDuration}
                onChange={e => setSlotSettings({ ...slotSettings, slotDuration: parseInt(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">Default: 30 minutes</p>
            </div>
            <div>
              <label className="label">Gap Between Slots (Minutes)</label>
              <input
                type="number"
                className="input"
                value={slotSettings.gapBetweenSlots}
                onChange={e => setSlotSettings({ ...slotSettings, gapBetweenSlots: parseInt(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">Default: 0 minutes</p>
            </div>
            <div>
              <label className="label">Parents Per Slot (Default Capacity)</label>
              <input
                type="number"
                className="input"
                value={slotSettings.parentsPerSlot}
                onChange={e => setSlotSettings({ ...slotSettings, parentsPerSlot: parseInt(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">Default: 3 parents</p>
            </div>
            <div>
              <label className="label">Max Saturday Default Slots</label>
              <input
                type="number"
                className="input"
                value={slotSettings.maxDefaultSaturdaySlots}
                onChange={e => setSlotSettings({ ...slotSettings, maxDefaultSaturdaySlots: parseInt(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">Maximum slots to release for 2nd & 4th Saturdays</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Default Saturday Slots</h4>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                System will release slots for <strong>2nd & 4th Saturdays</strong> of current and next month between <strong>2 PM to 4 PM</strong>.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                This can be triggered manually from the Slot Management page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grade & Seats Tab */}
      {activeTab === 'grades' && gradeSettings && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Seat Availability per Grade</h3>
            <button
              onClick={handleSaveGradeRules}
              disabled={saving || (JSON.stringify(gradeRules) === JSON.stringify(initialGradeRules) && JSON.stringify(gradeSettings) === JSON.stringify(initialGradeSettings))}
              className={`btn-primary transition-all ${(JSON.stringify(gradeRules) === JSON.stringify(initialGradeRules) && JSON.stringify(gradeSettings) === JSON.stringify(initialGradeSettings)) ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 opacity-70' : ''}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
              <div>
                <label className="label">Admission Age Cut-off Month-Day</label>
                <input
                  type="text"
                  className="input"
                  placeholder="MM-DD (e.g. 07-31)"
                  value={gradeSettings.cutOffDate}
                  onChange={e => setGradeSettings({ ...gradeSettings, cutOffDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Allowed Age Variation (Grades)</label>
                <input
                  type="number"
                  className="input"
                  value={gradeSettings.additionalGradesAllowed}
                  onChange={e => setGradeSettings({ ...gradeSettings, additionalGradesAllowed: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-bold text-xs text-gray-500 uppercase">
                <div className="col-span-1">Grade</div>
                <div className="col-span-1 text-center">Min Age</div>
                <div className="col-span-1 text-center">Total Seats</div>
                <div className="col-span-1 text-center">Occupied</div>
                <div className="col-span-1 text-center">Available</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {gradeRules.map((rule, index) => (
                <div key={index} className="grid grid-cols-6 gap-4 items-center p-4 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div className="col-span-1">
                    <input
                      type="text"
                      className="input font-bold"
                      value={rule.grade}
                      onChange={e => {
                        const newRules = [...gradeRules];
                        newRules[index] = { ...newRules[index], grade: e.target.value };
                        setGradeRules(newRules);
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      step="0.1"
                      className="input text-center"
                      value={rule.minAge}
                      onChange={e => {
                        const newRules = [...gradeRules];
                        newRules[index] = { ...newRules[index], minAge: parseFloat(e.target.value) || 0 };
                        setGradeRules(newRules);
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      className="input text-center font-bold text-primary-600"
                      value={rule.totalSeats ?? 50}
                      onChange={e => {
                        const newRules = [...gradeRules];
                        newRules[index] = { ...newRules[index], totalSeats: parseInt(e.target.value) || 0 };
                        setGradeRules(newRules);
                      }}
                    />
                  </div>
                  <div className="col-span-1 text-center font-bold text-gray-900">
                    <span className={`px-3 py-1 rounded-full text-xs ${rule.occupiedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {rule.occupiedCount || 0}
                    </span>
                  </div>
                  <div className="col-span-1 text-center font-bold">
                    <span className={`px-3 py-1 rounded-full text-xs ${(rule.availableSeats || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {rule.availableSeats ?? (rule.totalSeats ?? 50)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => setGradeRules(gradeRules.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-600 p-2 transition-colors"
                      title="Delete Grade"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setGradeRules([...gradeRules, { grade: 'New Grade', minAge: 3.0, totalSeats: 50, order: gradeRules.length }])}
                className="btn-secondary w-full py-3 border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Grade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="card border-amber-200 bg-amber-50">
            <h3 className="text-lg font-bold text-amber-900 mb-2">Step 1: Export System Data</h3>
            <p className="text-sm text-amber-700 mb-4">
              Before resetting the admission cycle, you must download a complete record of all applications.
              The reset button will only be enabled after a successful export.
            </p>
            <button
              onClick={handleExport}
              disabled={saving}
              className="btn-primary bg-amber-600 hover:bg-amber-700 border-none px-8"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Download Excel Export
            </button>
          </div>

          <div className={`card ${isExported ? 'border-red-200' : 'opacity-50 grayscale pointer-events-none'}`}>
            <h3 className="text-lg font-bold text-red-900 mb-2">Step 2: Reset Admission Cycle</h3>
            <p className="text-sm text-red-700 mb-6">
              This action will permanently delete all enquiries, admission applications, slot bookings, and counselling slots.
              Settings and templates will be preserved.
            </p>

            <div className="space-y-4 max-w-md">
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg mb-4">
                <p className="text-xs font-bold text-red-800 uppercase mb-2">Principal Confirmation Required</p>
                <div className="space-y-3">
                  <div>
                    <label className="label text-red-900">Principal Email</label>
                    <input
                      type="email"
                      className="input border-red-200 focus:ring-red-500"
                      value={resetCredentials.principalEmail}
                      onChange={e => setResetCredentials({ ...resetCredentials, principalEmail: e.target.value })}
                      placeholder="principal@school.com"
                    />
                  </div>
                  <div>
                    <label className="label text-red-900">Principal Password</label>
                    <input
                      type="password"
                      className="input border-red-200 focus:ring-red-500"
                      value={resetCredentials.principalPassword}
                      onChange={e => setResetCredentials({ ...resetCredentials, principalPassword: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                disabled={saving || !isExported || !resetCredentials.principalEmail || !resetCredentials.principalPassword}
                className="btn-primary bg-red-600 hover:bg-red-700 border-none w-full py-4 text-lg"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                WIPE ALL DATA & RESET CYCLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Field Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Add New Field</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Field Label</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. Date of Birth"
                  value={newFieldData.label}
                  onChange={(e) => setNewFieldData({ ...newFieldData, label: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Field Type</label>
                <select
                  className="input w-full"
                  value={newFieldData.type}
                  onChange={(e) => setNewFieldData({ ...newFieldData, type: e.target.value })}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone</option>
                  <option value="select">Select (List)</option>
                  <option value="textarea">Textarea</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAddField}
                disabled={!newFieldData.label.trim()}
                className="btn-primary flex-1"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
        confirmText="Yes, Delete Everything"
      />
    </div>
  )
}
