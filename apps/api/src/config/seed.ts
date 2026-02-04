import bcrypt from 'bcryptjs';
import { AdminUser, FormTemplate, DocumentsList, GradeRule, GradeSettings, CounsellingSlot } from '../models';

const DEFAULT_ADMIN = {
  username: 'Admin',
  email: 'admin@nes.edu.in',
  password: 'admin123',
  role: 'superadmin' as const
};

const DEFAULT_ENQUIRY_TEMPLATE = {
  type: 'enquiry' as const,
  fields: [
    { name: 'parentName', label: 'Parent/Guardian Name', type: 'text' as const, required: true, order: 1, placeholder: 'Enter parent name' },
    { name: 'childName', label: 'Student Name', type: 'text' as const, required: true, order: 2, placeholder: 'Enter student name' },
    { name: 'dob', label: 'Date of Birth', type: 'date' as const, required: true, order: 3 },
    { name: 'mobile', label: 'Mobile Number', type: 'tel' as const, required: true, order: 4, placeholder: '+91 XXXXX XXXXX' },
    { name: 'email', label: 'Email Address', type: 'email' as const, required: true, order: 5, placeholder: 'email@example.com' },
    { name: 'city', label: 'City', type: 'text' as const, required: false, order: 6, placeholder: 'Enter city' },
    { name: 'grade', label: 'Class Applying For', type: 'select' as const, required: true, order: 7, options: ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'] },
    { name: 'message', label: 'Additional Remarks', type: 'textarea' as const, required: false, order: 8, placeholder: 'Any additional information...' }
  ]
};

const DEFAULT_GRADE_RULES = [
  { grade: 'Nursery', minAge: 3, order: 1 },
  { grade: 'LKG', minAge: 4, order: 2 },
  { grade: 'UKG', minAge: 5, order: 3 },
  { grade: 'Class 1', minAge: 6, order: 4 },
  { grade: 'Class 2', minAge: 7, order: 5 },
  { grade: 'Class 3', minAge: 8, order: 6 },
  { grade: 'Class 4', minAge: 9, order: 7 },
  { grade: 'Class 5', minAge: 10, order: 8 },
  { grade: 'Class 6', minAge: 11, order: 9 },
  { grade: 'Class 7', minAge: 12, order: 10 },
  { grade: 'Class 8', minAge: 13, order: 11 },
  { grade: 'Class 9', minAge: 14, order: 12 },
  { grade: 'Class 10', minAge: 15, order: 13 },
  { grade: 'Class 11', minAge: 16, order: 14 },
  { grade: 'Class 12', minAge: 17, order: 15 },
];

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
  }

  // Seed principal user
  const PRINCIPAL_USER = {
    username: 'Principal',
    email: 'principal@nes.edu.in',
    password: 'principal123',
    role: 'principal' as const
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
  } else if (principalExists.role !== 'principal') {
    // Correcting role if it was seeded incorrectly before
    principalExists.role = 'principal';
    await principalExists.save();
    console.log('Principal role corrected to "principal"');
  }

  // Seed enquiry form template
  await FormTemplate.findOneAndUpdate(
    { type: 'enquiry' },
    DEFAULT_ENQUIRY_TEMPLATE,
    { upsert: true }
  );

  // Seed grade rules
  const rulesCount = await GradeRule.countDocuments();
  if (rulesCount === 0) {
    await GradeRule.insertMany(DEFAULT_GRADE_RULES);
    await GradeSettings.create({ key: 'global', cutOffDate: '07-31', additionalGradesAllowed: 2 });
    console.log('Default grade rules seeded');
  }

  // Slots will be managed manually by admin

  // Seed admission form template
  const admissionTemplateExists = await FormTemplate.findOne({ type: 'admission' });
  if (!admissionTemplateExists) {
    await FormTemplate.create(DEFAULT_ADMISSION_TEMPLATE);
  }

  // Seed documents list
  const documentsListExists = await DocumentsList.findOne();
  if (!documentsListExists) {
    await DocumentsList.create(DEFAULT_DOCUMENTS_LIST);
  }

  console.log('Database seed check complete');
}
