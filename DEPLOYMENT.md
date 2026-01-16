# 🚀 Deployment Guide: Sayuj School Management System

This guide outlines the steps to deploy the application with the **Frontend on Vercel** and the **Backend on Render**.

---

## 1. Backend Deployment (Render)

### Step 1: Connect GitHub
1. Sign in to [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository and select the project.

### Step 2: Configure Web Service
- **Name**: `sayuj-api` (or your choice)
- **Root Directory**: `apps/api`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build` (or `pnpm install && pnpm run build`)
- **Start Command**: `npm start` (or `pnpm start`)

### Step 3: Environment Variables
Add the following in the **Environment** tab:
| Key | Value (Example) |
|-----|-----|
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | `your_secret_string` |
| `PORT` | `5002` (Render usually sets this automatically) |
| `FRONTEND_URL` | `https://your-app.vercel.app` (Add after Vercel is deployed) |
| `CLOUDINARY_URL` | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `your_cloud_name` |

---

## 2. Frontend Deployment (Vercel)

### Step 1: Import Project
1. Sign in to [Vercel](https://vercel.com/dashboard).
2. Click **Add New** -> **Project**.
3. Select your GitHub repository.

### Step 2: Configure Project
- **Framework Preset**: `Next.js`
- **Root Directory**: `apps/web`
- **Build Command**: `npm run build` (or `pnpm run build`)
- **Install Command**: `npm install` (or `pnpm install`)

### Step 3: Environment Variables
Add the following:
| Key | Value |
|-----|-----|
| `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com` (Use your Render URL) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `your_cloud_name` (Same as backend) |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | `your_api_key` |

---

## 3. Post-Deployment Sync
1. Once Vercel provides your frontend URL (e.g., `https://sayuj.vercel.app`), go back to **Render Environment Variables**.
2. Update `FRONTEND_URL` with your actual Vercel domain.
3. This ensures the backend allows CORS requests from your production frontend.

### Important Note:
Ensure your `pnpm-lock.yaml` is up to date in the root directory before pushing, as both Vercel and Render will use it to install dependencies across the monorepo workspace.

---
**Done!** Your school management system is now live and ready for production.
