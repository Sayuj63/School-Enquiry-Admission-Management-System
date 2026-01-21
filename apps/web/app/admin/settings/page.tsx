'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Loader2, GripVertical, CheckSquare, Square } from 'lucide-react'
import {
  getEnquiryTemplate,
  updateEnquiryTemplate,
  getAdmissionTemplate,
  updateAdmissionTemplate,
  getDocumentsList,
  updateDocumentsList
} from '@/lib/api'

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
  const [activeTab, setActiveTab] = useState<'enquiry' | 'admission' | 'documents'>('enquiry')
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

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [currentAddType, setCurrentAddType] = useState<'enquiry' | 'admission'>('enquiry')
  const [newFieldData, setNewFieldData] = useState({ label: '', type: 'text' })

  useEffect(() => {
    fetchData()
  }, [])

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
    { id: 'documents', label: 'Required Documents' }
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
    </div>
  )
}
