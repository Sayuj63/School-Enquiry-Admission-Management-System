# School Enquiry & Admission Management System

A full-stack monorepo application for managing school enquiries, admissions, and counselling slot bookings.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Monorepo** | pnpm workspaces |
| **Backend** | Express.js + TypeScript |
| **Frontend** | Next.js 14 + TypeScript + Tailwind CSS |
| **Database** | MongoDB Atlas |
| **API Docs** | Scalar (OpenAPI 3.1) |

## Project Structure

```
sayuj/
├── apps/
│   ├── api/                    # Express.js backend (port 5002)
│   │   ├── src/
│   │   │   ├── config/         # Database & seed config
│   │   │   ├── middleware/     # Auth & upload middleware
│   │   │   ├── models/         # Mongoose models
│   │   │   ├── routes/         # API routes
│   │   │   ├── services/       # OTP, WhatsApp, Email services
│   │   │   ├── openapi.ts      # OpenAPI specification
│   │   │   └── index.ts        # Express app entry
│   │   └── uploads/            # Document uploads
│   └── web/                    # Next.js frontend (port 3000)
│       ├── app/
│       │   ├── (public)/       # Parent-facing pages
│       │   │   ├── enquiry/    # Enquiry form
│       │   │   └── success/    # Success page
│       │   └── admin/          # Admin dashboard
│       │       ├── dashboard/
│       │       ├── enquiries/
│       │       ├── admissions/
│       │       ├── slots/
│       │       └── settings/
│       └── lib/                # API client
└── packages/
    └── shared/                 # Shared TypeScript types
```

## Quick Start

### Prerequisites

- **Node.js** 18+
- **pnpm** 8+ (`npm install -g pnpm`)
- **MongoDB Atlas** account (free tier works)

### 1. Clone the Repository

```bash
git clone https://github.com/AnshumanAtrey/School-Enquiry-Admission-Management-System.git
cd School-Enquiry-Admission-Management-System
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

#### Backend (`apps/api/.env`)

Create or update the `.env` file:

```env
# MongoDB - REQUIRED
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/school_admission

# Server
PORT=5002
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production

# School Details
SCHOOL_NAME=ABC International School
SCHOOL_EMAIL=info@abcschool.com
SCHOOL_PHONE=+919876543210
PRINCIPAL_EMAIL=principal@abcschool.com

# Twilio (Optional - mocked in development)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
WHATSAPP_NUMBER=whatsapp:+14155238886

# SMTP (Optional - mocked in development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=school@example.com
SMTP_PASS=your_app_password
```

#### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5002
```

### 4. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster (or use existing)
3. **Important**: Add your IP to the whitelist:
   - Navigate to **Network Access** → **Add IP Address**
   - Click **"Add Current IP Address"** or **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Copy the connection string and update `MONGODB_URI` in `.env`

### 5. Run the Application

```bash
# Run both backend and frontend
pnpm dev
```

Or run individually:

```bash
# Backend only
pnpm dev:api

# Frontend only
pnpm dev:web
```

### 6. Access the Application

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:5002 |
| **API Documentation** | http://localhost:5002/docs |
| **Health Check** | http://localhost:5002/health |
| **OpenAPI Spec** | http://localhost:5002/openapi.json |

### Default Admin Credentials

```
Email: admin@school.com
Password: admin123
```

---

## Features

### Module 1: Enquiry Form (Public)
- OTP verification for mobile number
- Auto-generates unique Token ID (`ENQ-YYYYMMDD-XXXXXX`)
- WhatsApp notification with brochure (mocked in dev)
- Success page with token display

### Module 2: Admission Management (Admin)
- View and manage all enquiries
- Generate admission forms (pre-filled from enquiry)
- Upload documents (PDF, JPG, PNG - max 5MB)
- Track admission status (Draft → Submitted → Approved/Rejected)

### Module 3: Counselling Slots (Admin)
- Create counselling slots (fixed capacity: 3)
- Book slots for admissions
- Calendar invites sent to parent and principal (mocked in dev)

### Admin-Editable Templates
- Enquiry form fields
- Admission form fields
- Required documents list

---

## API Documentation

Full API documentation is available via **Scalar** at:

```
http://localhost:5002/docs
```

### External Integration API

For external frontend integration (e.g., Yash's frontend):

```http
POST http://localhost:5002/api/enquiry
Content-Type: application/json

{
  "parent_name": "Rajesh Kumar",
  "child_name": "Arjun Kumar",
  "mobile": "+919876543210",
  "email": "rajesh@email.com",
  "city": "Mumbai",
  "grade": "Class 5",
  "message": "Interested in admission"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenId": "ENQ-20260110-ABC123",
    "message": "Enquiry submitted successfully"
  }
}
```

### Key API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/enquiry` | Submit enquiry | No |
| `POST` | `/api/otp/send` | Send OTP | No |
| `POST` | `/api/otp/verify` | Verify OTP | No |
| `POST` | `/api/auth/login` | Admin login | No |
| `GET` | `/api/enquiries` | List enquiries | Yes |
| `POST` | `/api/admission/create/:id` | Create admission | Yes |
| `POST` | `/api/slots` | Create slot | Yes |
| `POST` | `/api/slots/:id/book` | Book slot | Yes |
| `GET` | `/api/templates/enquiry` | Get form template | No |

See full documentation at `/docs` endpoint.

---

## Development Notes

### Mocked Services

In development mode (`NODE_ENV=development`), the following services are mocked:

1. **OTP Service**: OTP is logged to console and returned in API response
2. **WhatsApp Service**: Messages logged to console instead of sending
3. **Email Service**: Calendar invites logged to console

### File Uploads

- Documents stored in `apps/api/uploads/` directory
- Organized by admission ID: `uploads/{admissionId}/{filename}`
- Allowed types: PDF, JPG, PNG
- Max size: 5MB

### Token ID Format

```
ENQ-YYYYMMDD-XXXXXX

Example: ENQ-20260110-A3F9K2
```

### Slot Capacity

Fixed at 3 per slot (as per requirements). Cannot be changed by admin.

---

## Scripts

```bash
# Development
pnpm dev          # Run all apps
pnpm dev:api      # Run backend only
pnpm dev:web      # Run frontend only

# Build
pnpm build        # Build all apps

# Linting
pnpm lint         # Lint all apps
```

---

## Troubleshooting

### MongoDB Connection Error

```
MongooseServerSelectionError: Could not connect to any servers
```

**Solution**: Add your IP to MongoDB Atlas whitelist:
1. MongoDB Atlas → Network Access → Add IP Address
2. Add your current IP or `0.0.0.0/0` for development

### Port Already in Use

```bash
# Kill process on port 5002
lsof -ti:5002 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### pnpm Not Found

```bash
npm install -g pnpm
```

---

## License

MIT

---

## Support

For issues or questions, please open an issue on GitHub.
