export type AdminRole = 'admin' | 'superadmin';

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

export interface OTPSendRequest {
  mobile: string;
}

export interface OTPVerifyRequest {
  mobile: string;
  otp: string;
}

export interface OTPResponse {
  success: boolean;
  message: string;
}
