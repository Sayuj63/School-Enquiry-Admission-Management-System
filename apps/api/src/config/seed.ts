import bcrypt from 'bcryptjs';
import { AdminUser, FormTemplate, DocumentsList } from '../models';

const DEFAULT_ADMIN = {
  username: 'Admin',
  email: 'admin@school.com',
  password: 'admin123',
  role: 'superadmin' as const
};

const DEFAULT_ENQUIRY_TEMPLATE = {
  type: 'enquiry' as const,
  fields: [
    { name: 'parentName', label: 'Parent/Guardian Name', type: 'text' as const, required: true, order: 1, placeholder: 'Enter parent name' },
    { name: 'childName', label: 'Student Name', type: 'text' as const, required: true, order: 2, placeholder: 'Enter student name' },
    { name: 'mobile', label: 'Mobile Number', type: 'tel' as const, required: true, order: 3, placeholder: '+91 XXXXX XXXXX' },
    { name: 'email', label: 'Email Address', type: 'email' as const, required: true, order: 4, placeholder: 'email@example.com' },
    { name: 'city', label: 'City', type: 'text' as const, required: false, order: 5, placeholder: 'Enter city' },
    { name: 'grade', label: 'Class Applying For', type: 'select' as const, required: true, order: 6, options: ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'] },
    { name: 'message', label: 'Additional Remarks', type: 'textarea' as const, required: false, order: 7, placeholder: 'Any additional information...' }
  ]
};

const DEFAULT_ADMISSION_TEMPLATE = {
  type: 'admission' as const,
  fields: [
    { name: 'studentDob', label: 'Student Date of Birth', type: 'date' as const, required: true, order: 1 },
    { name: 'parentAddress', label: 'Residential Address', type: 'textarea' as const, required: true, order: 2, placeholder: 'Full address with PIN code' },
    { name: 'parentOccupation', label: 'Parent Occupation', type: 'text' as const, required: false, order: 3, placeholder: 'e.g., Software Engineer' },
    { name: 'emergencyContact', label: 'Emergency Contact Number', type: 'tel' as const, required: true, order: 4, placeholder: '+91 XXXXX XXXXX' },
    { name: 'previousSchool', label: 'Previous School Name', type: 'text' as const, required: false, order: 5, placeholder: 'If applicable' },
    { name: 'bloodGroup', label: 'Blood Group', type: 'select' as const, required: false, order: 6, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
    { name: 'medicalConditions', label: 'Medical Conditions (if any)', type: 'textarea' as const, required: false, order: 7, placeholder: 'Allergies, conditions, etc.' }
  ]
};

const DEFAULT_DOCUMENTS_LIST = {
  documents: [
    { name: 'Birth Certificate', required: true, order: 1 },
    { name: 'Address Proof (Aadhaar Card)', required: true, order: 2 },
    { name: 'Previous School Transfer Certificate', required: false, order: 3 },
    { name: 'Previous School Report Card', required: false, order: 4 },
    { name: 'Passport Size Photographs (4 copies)', required: true, order: 5 },
    { name: 'Parent ID Proof', required: true, order: 6 },
    { name: 'Medical Fitness Certificate', required: false, order: 7 }
  ]
};

export async function seedDatabase(): Promise<void> {
  console.log('Checking database seed...');

  // Seed admin user
  const adminExists = await AdminUser.findOne({ email: DEFAULT_ADMIN.email });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    await AdminUser.create({
      username: DEFAULT_ADMIN.username,
      email: DEFAULT_ADMIN.email,
      passwordHash,
      role: DEFAULT_ADMIN.role
    });
    console.log('Default admin user created:');
    console.log(`  Email: ${DEFAULT_ADMIN.email}`);
    console.log(`  Password: ${DEFAULT_ADMIN.password}`);
  }

  // Seed principal user
  const PRINCIPAL_USER = {
    username: 'Principal',
    email: 'principal@school.com',
    password: 'principal123',
    role: 'admin' as const
  };

  const principalExists = await AdminUser.findOne({ email: PRINCIPAL_USER.email });
  if (!principalExists) {
    const passwordHash = await bcrypt.hash(PRINCIPAL_USER.password, 10);
    await AdminUser.create({
      username: PRINCIPAL_USER.username,
      email: PRINCIPAL_USER.email,
      passwordHash,
      role: PRINCIPAL_USER.role
    });
    console.log('Default principal user created:');
    console.log(`  Email: ${PRINCIPAL_USER.email}`);
    console.log(`  Password: ${PRINCIPAL_USER.password}`);
  }

  // Seed enquiry form template
  const enquiryTemplateExists = await FormTemplate.findOne({ type: 'enquiry' });
  if (!enquiryTemplateExists) {
    await FormTemplate.create(DEFAULT_ENQUIRY_TEMPLATE);
    console.log('Default enquiry form template created');
  }

  // Seed admission form template
  const admissionTemplateExists = await FormTemplate.findOne({ type: 'admission' });
  if (!admissionTemplateExists) {
    await FormTemplate.create(DEFAULT_ADMISSION_TEMPLATE);
    console.log('Default admission form template created');
  }

  // Seed documents list
  const documentsListExists = await DocumentsList.findOne();
  if (!documentsListExists) {
    await DocumentsList.create(DEFAULT_DOCUMENTS_LIST);
    console.log('Default documents list created');
  }

  console.log('Database seed check complete');
}
