const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5002';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = sessionStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null, persistent: boolean = false) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        if (persistent) {
          localStorage.setItem('auth_token', token);
        } else {
          sessionStorage.setItem('auth_token', token);
        }
      } else {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined' && !this.token) {
      this.token = sessionStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      (headers as any)['Content-Type'] = 'application/json';
    }

    // Always get fresh token from localStorage before each request
    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    } else {
      // Try one more time if running in browser
      if (typeof window !== 'undefined') {
        const freshToken = sessionStorage.getItem('auth_token');
        if (freshToken) {
          this.token = freshToken;
          (headers as Record<string, string>)['Authorization'] = `Bearer ${freshToken}`;
        }
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      // Pretty print mock data if present
      this.prettyPrintMock(data);

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
        };
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  private prettyPrintMock(data: any) {
    if (typeof window === 'undefined') return;

    // 1. Check for OTP mock
    if (data.success && data.otp) {
      console.log('========================================');
      console.log('OTP SERVICE (MOCK MODE)');
      console.log('----------------------------------------');
      console.log(`Mobile: ${data.mobile}`);
      console.log(`OTP: ${data.otp}`);
      console.log(`Expires: ${data.expiresAt}`);
      console.log('========================================');
    }

    // 2. Check for Single mockNotification (Enquiry)
    if (data.data?.mockNotification) {
      const mock = data.data.mockNotification;
      console.log('========================================');
      console.log(`${mock.type.toUpperCase()} SERVICE (MOCK MODE)`);
      console.log('----------------------------------------');
      console.log(`To: ${mock.to}`);
      console.log('Message:');
      console.log(mock.content);
      console.log('========================================');
    }

    // 3. Check for Array of mockNotifications (Slot booking)
    if (data.data?.mockNotifications && Array.isArray(data.data.mockNotifications)) {
      data.data.mockNotifications.forEach((mock: any) => {
        console.log('========================================');
        console.log(`${mock.type.toUpperCase()} SERVICE (MOCK MODE)`);
        console.log('----------------------------------------');
        console.log(`To: ${mock.to}`);
        console.log('Message:');
        console.log(mock.content);
        console.log('========================================');
      });
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('document', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const headers: HeadersInit = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Upload failed',
        };
      }

      return data;
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: 'Upload failed. Please try again.',
      };
    }
  }
}

export const api = new ApiClient(API_URL);

// Auth functions
export async function login(email: string, password: string) {
  const result = await api.post<{ token: string; user: any }>('/api/auth/login', {
    email,
    password,
  });

  if (result.success && result.data?.token) {
    api.setToken(result.data.token);
  }

  return result;
}

export async function logout() {
  api.setToken(null);
}

export async function getCurrentUser() {
  return api.get<any>('/api/auth/me');
}

// OTP functions
export async function sendOTP(mobile: string) {
  return api.post<{ otp?: string }>('/api/otp/send', { mobile });
}

export async function verifyOTP(mobile: string, otp: string) {
  return api.post('/api/otp/verify', { mobile, otp });
}

// Enquiry functions
export async function submitEnquiry(data: any) {
  return api.post<{ id: string; tokenId: string }>('/api/enquiry', data);
}

export async function adminSubmitEnquiry(data: any) {
  return api.post<any>('/api/enquiry/admin', data);
}

export async function lookupEnquiries(mobile: string) {
  const normalizedMobile = mobile.replace(/\D/g, '');
  return api.get<any>(`/api/enquiry/lookup/${normalizedMobile}`);
}

export async function getEnquiries(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  grade?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.status) searchParams.append('status', params.status);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.grade) searchParams.append('grade', params.grade);
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);

  return api.get<any>(`/api/enquiries?${searchParams.toString()}`);
}

export async function getEnquiry(id: string) {
  return api.get<any>(`/api/enquiry/${id}`);
}

export async function getEnquiryByToken(tokenId: string) {
  return api.get<any>(`/api/enquiry/token/${tokenId}`);
}

export async function resendNotification(id: string) {
  return api.post<any>(`/api/enquiry/${id}/notify`);
}

export async function getEnquiryDraft(id: string) {
  return api.get<any>(`/api/enquiry/draft/${id}`);
}

export async function uploadEnquiryDraftDocument(enquiryId: string, documentType: string, file: File) {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', documentType);

  return api.post<any>(`/api/enquiry/draft/${enquiryId}/documents`, formData);
}

export async function deleteEnquiryDraftDocument(enquiryId: string, docId: string) {
  return api.delete<any>(`/api/enquiry/draft/${enquiryId}/documents/${docId}`);
}

export async function getEnquiriesByMobile(mobile: string) {
  return api.get<any>(`/api/enquiry/lookup/${mobile}`);
}

export async function uploadParentDocument(tokenId: string, documentType: string, file: File) {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', documentType);

  return api.post<any>(`/api/admission/parent/${tokenId}/documents`, formData);
}

export async function deleteParentDocument(tokenId: string, docId: string) {
  return api.delete<any>(`/api/admission/parent/${tokenId}/documents/${docId}`);
}

export async function getDashboardStats() {
  return api.get<any>('/api/enquiries/stats/dashboard');
}

// Admission functions
export async function createAdmission(enquiryId: string) {
  return api.post<any>(`/api/admission/create/${enquiryId}`);
}

export async function getAdmission(id: string) {
  return api.get<any>(`/api/admission/${id}`);
}

export async function getAdmissions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  noSlot?: boolean;
  counselling?: 'booked' | 'pending';
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.status) searchParams.append('status', params.status);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.noSlot) searchParams.append('noSlot', 'true');
  if (params?.counselling) searchParams.append('counselling', params.counselling);

  return api.get<any>(`/api/admissions?${searchParams.toString()}`);
}

export async function updateAdmission(id: string, data: any) {
  return api.put<any>(`/api/admission/${id}`, data);
}

export async function uploadDocument(admissionId: string, file: File, documentType: string) {
  return api.uploadFile<any>(`/api/admission/${admissionId}/documents`, file, {
    documentType,
  });
}

export async function deleteDocument(admissionId: string, docId: string) {
  return api.delete<any>(`/api/admission/${admissionId}/documents/${docId}`);
}

// Slot functions
export async function getSlots(params?: { dateFrom?: string; dateTo?: string; status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);
  if (params?.status) searchParams.append('status', params.status);

  return api.get<any>(`/api/slots?${searchParams.toString()}`);
}

export async function getAvailableSlots() {
  return api.get<any>('/api/slots/available');
}

export async function createSlot(data: { date: string; startTime: string; endTime: string; capacity?: number }) {
  return api.post<any>('/api/slots', data);
}

export async function updateSlot(id: string, data: { status?: string; capacity?: number }) {
  return api.put<any>(`/api/slots/${id}`, data);
}

export async function bulkGenerateSlots(availability: Array<{ date: string; startTime: string; endTime: string }>) {
  return api.post<any>('/api/slots/generate-bulk', { availability });
}

export async function generateSaturdaySlots() {
  return api.post<any>('/api/slots/generate-saturday-defaults');
}

export async function deleteSlot(id: string) {
  return api.delete<any>(`/api/slots/${id}`);
}

export async function bookSlot(slotId: string, admissionId: string) {
  return api.post<any>(`/api/slots/${slotId}/book`, { admissionId });
}

export async function cancelBooking(slotId: string, bookingId: string) {
  return api.delete<any>(`/api/slots/${slotId}/bookings/${bookingId}`);
}

export async function markNoShow(bookingId: string) {
  return api.post<any>(`/api/slots/bookings/${bookingId}/no-show`);
}

export async function cancelSlotBySchool(slotId: string) {
  return api.post<any>(`/api/slots/${slotId}/cancel`);
}

export async function getExistingBookingByMobile(mobile: string) {
  return api.get<any>(`/api/slots/booking/mobile/${mobile}`);
}

export async function getRescheduleOptions(tokenId: string) {
  return api.get<any>(`/api/slots/reschedule-options/${tokenId}`);
}

export async function rescheduleSlotByParent(tokenId: string, slotId: string) {
  return api.post<any>(`/api/slots/reschedule-parent/${tokenId}`, { slotId });
}

export async function bookSlotByParent(tokenId: string, slotId: string) {
  return api.post<any>(`/api/slots/book-parent/${tokenId}`, { slotId });
}

// Template functions
export async function getEnquiryTemplate() {
  return api.get<any>('/api/templates/enquiry');
}

export async function updateEnquiryTemplate(fields: any[], baseFields?: Record<string, boolean>) {
  return api.put<any>('/api/templates/enquiry', { fields, baseFields });
}

export async function getAdmissionTemplate() {
  return api.get<any>('/api/templates/admission');
}

export async function updateAdmissionTemplate(fields: any[], baseFields?: Record<string, boolean>) {
  return api.put<any>('/api/templates/admission', { fields, baseFields });
}

export async function getDocumentsList() {
  return api.get<any>('/api/templates/documents');
}

export async function updateDocumentsList(documents: any[]) {
  return api.put<any>('/api/templates/documents', { documents });
}

// Settings functions
export async function getGradeRules() {
  return api.get<any>('/api/settings/grade-rules');
}

export async function getNotificationSettings() {
  return api.get<any>('/api/settings/notifications');
}

export async function updateNotificationSettings(data: any) {
  return api.put<any>('/api/settings/notifications', data);
}

export async function getSlotSettings() {
  return api.get<any>('/api/settings/slots');
}

export async function updateSlotSettings(data: any) {
  return api.put<any>('/api/settings/slots', data);
}
export async function updateGradeRules(data: { rules: any[], settings: any }) {
  return api.put<any>('/api/settings/grade-rules', data);
}

export async function exportAdmissions() {
  const token = api.getToken();
  const response = await fetch(`${API_URL}/api/settings/export`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Export failed');
  return response.blob();
}

export async function resetAdmissionCycle(credentials: any) {
  return api.post<any>('/api/settings/reset-cycle', credentials);
}
