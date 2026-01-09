export type AdmissionStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface AdmissionDocument {
  _id: string;
  type: string;
  fileName: string;
  filePath: string;
  uploadedAt: string;
}

export interface Admission {
  _id: string;
  enquiryId: string;
  tokenId: string;

  // Pre-filled from Enquiry
  studentName: string;
  parentName: string;
  mobile: string;
  email: string;
  grade: string;

  // Additional fields (admin fills)
  studentDob?: string;
  parentAddress?: string;
  parentOccupation?: string;
  emergencyContact?: string;

  // Dynamic fields based on template
  additionalFields: Record<string, any>;

  // Documents
  documents: AdmissionDocument[];

  status: AdmissionStatus;
  notes?: string;
  slotBookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdmissionRequest {
  enquiryId: string;
}

export interface UpdateAdmissionRequest {
  studentDob?: string;
  parentAddress?: string;
  parentOccupation?: string;
  emergencyContact?: string;
  additionalFields?: Record<string, any>;
  status?: AdmissionStatus;
  notes?: string;
}
