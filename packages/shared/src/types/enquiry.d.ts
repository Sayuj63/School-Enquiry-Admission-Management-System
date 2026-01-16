export type EnquiryStatus = 'new' | 'in_progress' | 'converted';
export interface Enquiry {
    _id: string;
    tokenId: string;
    parentName: string;
    childName: string;
    mobile: string;
    mobileVerified: boolean;
    email: string;
    city: string;
    grade: string;
    message: string;
    status: EnquiryStatus;
    whatsappSent: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ExternalEnquiryRequest {
    parent_name: string;
    child_name: string;
    mobile: string;
    email: string;
    city: string;
    grade: string;
    message: string;
}
export interface CreateEnquiryRequest {
    parentName: string;
    childName: string;
    mobile: string;
    email: string;
    city: string;
    grade: string;
    message: string;
    mobileVerified?: boolean;
}
export interface EnquiryListResponse {
    enquiries: Enquiry[];
    total: number;
    page: number;
    limit: number;
}
//# sourceMappingURL=enquiry.d.ts.map