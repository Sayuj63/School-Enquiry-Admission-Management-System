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
    studentName: string;
    parentName: string;
    mobile: string;
    email: string;
    grade: string;
    studentDob?: string;
    parentAddress?: string;
    parentOccupation?: string;
    emergencyContact?: string;
    additionalFields: Record<string, any>;
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
//# sourceMappingURL=admission.d.ts.map