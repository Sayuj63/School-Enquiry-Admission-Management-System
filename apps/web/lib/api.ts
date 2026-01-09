const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

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
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined' && !this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

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

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
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
export async function submitEnquiry(data: {
  parentName: string;
  childName: string;
  mobile: string;
  email: string;
  city: string;
  grade: string;
  message: string;
}) {
  return api.post<{ tokenId: string }>('/api/enquiry', data);
}

export async function getEnquiries(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.status) searchParams.append('status', params.status);
  if (params?.search) searchParams.append('search', params.search);

  return api.get<any>(`/api/enquiries?${searchParams.toString()}`);
}

export async function getEnquiry(id: string) {
  return api.get<any>(`/api/enquiry/${id}`);
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
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.status) searchParams.append('status', params.status);
  if (params?.search) searchParams.append('search', params.search);

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

export async function createSlot(data: { date: string; startTime: string; endTime: string }) {
  return api.post<any>('/api/slots', data);
}

export async function updateSlot(id: string, data: { status: string }) {
  return api.put<any>(`/api/slots/${id}`, data);
}

export async function bookSlot(slotId: string, admissionId: string) {
  return api.post<any>(`/api/slots/${slotId}/book`, { admissionId });
}

export async function cancelBooking(slotId: string, bookingId: string) {
  return api.delete<any>(`/api/slots/${slotId}/bookings/${bookingId}`);
}

// Template functions
export async function getEnquiryTemplate() {
  return api.get<any>('/api/templates/enquiry');
}

export async function updateEnquiryTemplate(fields: any[]) {
  return api.put<any>('/api/templates/enquiry', { fields });
}

export async function getAdmissionTemplate() {
  return api.get<any>('/api/templates/admission');
}

export async function updateAdmissionTemplate(fields: any[]) {
  return api.put<any>('/api/templates/admission', { fields });
}

export async function getDocumentsList() {
  return api.get<any>('/api/templates/documents');
}

export async function updateDocumentsList(documents: any[]) {
  return api.put<any>('/api/templates/documents', { documents });
}
