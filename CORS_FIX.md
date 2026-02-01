# CORS Configuration for Production

## Quick Fix (Immediate)

I've updated the CORS configuration to automatically allow all Vercel deployments (*.vercel.app). 

**Deploy this fix:**
```bash
git add -A
git commit -m "fix: Allow Vercel deployments in CORS configuration"
git push origin main
```

After Render redeploys, your frontend will be able to connect.

---

## Recommended Setup (For Production)

For better security in production, set the `FRONTEND_URL` environment variable in your Render dashboard:

### Steps:

1. **Go to Render Dashboard** → Your API Service → Environment

2. **Add Environment Variable:**
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://school-enquiry-admission-management.vercel.app`

3. **For Multiple Domains** (if you have preview deployments):
   ```
   https://school-enquiry-admission-management.vercel.app,https://your-preview-branch.vercel.app
   ```

4. **Save and Redeploy**

---

## Current Configuration

The updated CORS now allows:
- ✅ All localhost origins (development)
- ✅ All `.vercel.app` domains (Vercel deployments)
- ✅ Any origins specified in `FRONTEND_URL` env variable
- ✅ Requests with no origin (mobile apps, Postman)

---

## Testing

After deploying, test by:
1. Opening your Vercel app: https://school-enquiry-admission-management.vercel.app
2. Trying to login
3. Check browser console - CORS error should be gone
4. Check Render logs - should see "CORS Configuration" logged on startup
