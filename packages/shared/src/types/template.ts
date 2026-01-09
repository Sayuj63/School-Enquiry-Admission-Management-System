export type FieldType = 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'date' | 'number';

export interface FormField {
  _id?: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  order: number;
  placeholder?: string;
}

export interface FormTemplate {
  _id: string;
  type: 'enquiry' | 'admission';
  fields: FormField[];
  updatedAt: string;
}

export interface RequiredDocument {
  _id?: string;
  name: string;
  required: boolean;
  order: number;
}

export interface DocumentsList {
  _id: string;
  documents: RequiredDocument[];
  updatedAt: string;
}

export interface UpdateFormTemplateRequest {
  fields: FormField[];
}

export interface UpdateDocumentsListRequest {
  documents: RequiredDocument[];
}
