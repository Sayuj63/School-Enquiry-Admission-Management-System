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
  { name: 'grade', label: 'Grade/Class' }
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'enquiry' | 'admission' | 'documents'>('enquiry')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [enquiryFields, setEnquiryFields] = useState<FormField[]>([])
  const [admissionFields, setAdmissionFields] = useState<FormField[]>([])
  const [admissionBaseFields, setAdmissionBaseFields] = useState<Record<string, boolean>>({
    studentName: true,
    parentName: true,
    mobile: true,
    email: true,
    grade: true
  })
  const [documents, setDocuments] = useState<RequiredDocument[]>([])

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
    }

    if (admissionResult.success && admissionResult.data) {
      setAdmissionFields(admissionResult.data.fields || [])
      if (admissionResult.data.baseFields) {
        // Map might come as an object or a Map depending on how it's serialized
        const bf = admissionResult.data.baseFields
        setAdmissionBaseFields(prev => ({
          ...prev,
          ...(bf instanceof Map ? Object.fromEntries(bf) : bf)
        }))
      }
    }

    if (docsResult.success && docsResult.data) {
      setDocuments(docsResult.data.documents || [])
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
    } else {
      setError(result.error || 'Failed to save')
    }

    setSaving(false)
  }

  const addField = (type: 'enquiry' | 'admission') => {
    const newField: FormField = {
      name: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      order: type === 'enquiry' ? enquiryFields.length : admissionFields.length
    }

    if (type === 'enquiry') {
      setEnquiryFields([...enquiryFields, newField])
    } else {
      setAdmissionFields([...admissionFields, newField])
    }
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
              <button onClick={() => addField('enquiry')} className="btn-secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </button>
              <button onClick={handleSaveEnquiry} disabled={saving} className="btn-primary">
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
                <button onClick={() => addField('admission')} className="btn-secondary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </button>
                <button onClick={handleSaveAdmission} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
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
              <button onClick={handleSaveDocuments} disabled={saving} className="btn-primary">
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
    </div>
  )
}
