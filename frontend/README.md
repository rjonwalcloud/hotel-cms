# 🎨 Hotel CMS Frontend

React + Vite frontend for the Hotel CMS application.

## ✅ Complete Feature List

### Authentication
- ✅ Login page with demo accounts
- ✅ Registration page
- ✅ Role-based access control
- ✅ JWT token management
- ✅ Auto-logout on session expiry

### Super Admin
- ✅ Dashboard with system overview
- ✅ Hotels CRUD management
- ✅ Quota monitoring and management
- ✅ Global audit log viewer

### Hotel Admin
- ✅ Hotel dashboard with statistics
- ✅ Room management (CRUD + status updates)
- ✅ Booking management (state machine workflow)
- ✅ Service/Menu management
- ✅ Hotel settings

### Staff
- ✅ Today's schedule dashboard
- ✅ Check-in/Check-out operations
- ✅ Room status updates
- ✅ Booking list view

### Shared
- ✅ User profile page
- ✅ Password change
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Toast notifications
- ✅ Data tables with search/pagination

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Backend API running (http://localhost:5000)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your backend URL
# VITE_API_URL=http://localhost:5000

# Start development server
npm run dev
```

The app will open at http://localhost:3000

---

## 🔑 Default Login Credentials

### Super Admin
```
Email: admin@hotelcms.com
Password: Admin@123
```

### Hotel Admin (if hotel exists)
```
Email: hotel@example.com
Password: Hotel@123
```

### Staff (if hotel exists)
```
Email: staff@example.com
Password: Staff@123
```

⚠️ **IMPORTANT:** Change these passwords immediately in production!

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Layout.jsx      # Main app layout
│   │   ├── Sidebar.jsx     # Navigation sidebar
│   │   ├── Header.jsx      # Top header
│   │   ├── DataTable.jsx   # Reusable table
│   │   ├── Modal.jsx       # Reusable modal
│   │   ├── StatsCard.jsx   # Statistics cards
│   │   └── ProtectedRoute.jsx
│   │
│   ├── pages/              # Page components
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Profile.jsx
│   │   ├── NotFound.jsx
│   │   │
│   │   ├── SuperAdmin/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── HotelsList.jsx
│   │   │   ├── QuotaManagement.jsx
│   │   │   └── GlobalAudit.jsx
│   │   │
│   │   ├── HotelAdmin/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── RoomManagement.jsx
│   │   │   ├── BookingManagement.jsx
│   │   │   ├── ServiceManagement.jsx
│   │   │   └── HotelSettings.jsx
│   │   │
│   │   └── Staff/
│   │       ├── Dashboard.jsx
│   │       ├── Bookings.jsx
│   │       └── Rooms.jsx
│   │
│   ├── services/
│   │   └── api.js          # All backend API calls
│   │
│   ├── store/
│   │   └── authStore.js    # Authentication state
│   │
│   ├── App.jsx             # Routing configuration
│   ├── main.jsx            # React entry point
│   └── index.css           # Global styles
│
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## 🔧 Environment Variables

Create `.env` file:

```env
# Backend API URL
VITE_API_URL=http://localhost:5000
```

For production:
```env
VITE_API_URL=https://your-api.onrender.com
```

---

## 🛠️ Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## 📦 Dependencies

### Core
- **React 18** - UI framework
- **React Router v6** - Routing
- **Vite** - Build tool

### State & Data
- **Zustand** - State management
- **Axios** - HTTP client
- **React Hook Form** - Form handling

### UI & Styling
- **Tailwind CSS** - Utility-first CSS
- **Lucide React** - Icons
- **React Hot Toast** - Notifications

### Utilities
- **date-fns** - Date formatting

---

## 🎨 Features by Role

### Super Admin Can:
- ✅ View all hotels
- ✅ Create/Edit hotels
- ✅ Manage quotas for each hotel
- ✅ View system-wide audit logs
- ✅ Monitor hotel statistics

### Hotel Admin Can:
- ✅ View hotel dashboard
- ✅ Manage rooms (CRUD)
- ✅ Manage bookings (create, check-in, check-out, cancel)
- ✅ Manage services/menu items
- ✅ Update hotel information
- ✅ View hotel statistics

### Staff Can:
- ✅ View today's bookings
- ✅ Check-in guests
- ✅ Check-out guests
- ✅ Update room status
- ✅ View all bookings

---

## 🔗 API Integration

All API calls are in `src/services/api.js`:

```javascript
import { authAPI, hotelAPI, roomAPI, bookingAPI } from './services/api';

// Example: Login
const response = await authAPI.login({ email, password });

// Example: Get hotels
const hotels = await hotelAPI.getAll();

// Example: Create booking
const booking = await bookingAPI.create({
  hotel_id: 'xxx',
  room_id: 'xxx',
  guest_name: 'John Doe',
  ...
});
```

---

## 🚀 Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variable
vercel env add VITE_API_URL production
# Enter: https://your-backend-api-url

# Deploy to production
vercel --prod
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod

# Set environment variables in Netlify dashboard
```

### Deploy to Same VPS as Backend

```bash
# Build locally
npm run build

# Upload to VPS
scp -r dist/* user@vps:/var/www/hotel-cms/frontend

# Configure Nginx to serve frontend
# See main DEPLOY_VPS.md guide
```

---

## 🎯 Booking State Machine

The booking workflow follows this state machine:

```
CREATED → CONFIRMED → CHECKED_IN → CHECKED_OUT
    ↓          ↓
CANCELLED  NO_SHOW
    ↓
REFUNDED
```

Transitions are enforced by backend. Frontend provides UI for valid actions:
- CONFIRMED → Check In button
- CHECKED_IN → Check Out button
- CREATED/CONFIRMED → Cancel button

---

## 🔒 Security Features

- ✅ JWT token stored in localStorage
- ✅ Auto-logout on token expiry
- ✅ Protected routes (redirect to login)
- ✅ Role-based page access
- ✅ CORS configuration
- ✅ Input validation on forms

---

## 📱 Responsive Design

- ✅ Mobile-first approach
- ✅ Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- ✅ Collapsible sidebar on mobile
- ✅ Touch-friendly buttons
- ✅ Responsive tables (horizontal scroll on mobile)

---

## 🐛 Troubleshooting

### Issue: Can't connect to backend

**Solution:** Check `.env` file has correct `VITE_API_URL`

```bash
# Should be:
VITE_API_URL=http://localhost:5000

# NOT:
VITE_API_URL=http://localhost:5000/api  # ❌ Don't include /api
```

### Issue: Login fails

**Solution:** 
1. Ensure backend is running
2. Check backend database has seed data
3. Try default credentials above
4. Check browser console for errors

### Issue: 404 on page refresh

**Solution:** Configure your server to redirect all routes to `index.html`

**Vercel/Netlify:** Automatic
**Nginx:** Add to config:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Issue: Blank page

**Solution:**
1. Check browser console
2. Ensure all dependencies installed (`npm install`)
3. Clear browser cache
4. Try incognito mode

---

## 🎓 Development Tips

### Adding a New Page

1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Sidebar.jsx`

### Making API Calls

```javascript
import { useState, useEffect } from 'react';
import { hotelAPI } from '../services/api';
import toast from 'react-hot-toast';

function MyComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await hotelAPI.getAll();
      setData(response.hotels);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };
}
```

### Using Auth Store

```javascript
import { useAuthStore } from '../store/authStore';

function MyComponent() {
  const { user, hasRole, getHotelId } = useAuthStore();
  
  if (hasRole('SUPER_ADMIN')) {
    // Show admin features
  }
  
  const hotelId = getHotelId();
  // Use hotelId for API calls
}
```

---

## ✅ Testing Checklist

Before deployment:

- [ ] All pages load without errors
- [ ] Login/logout works
- [ ] Role-based access works
- [ ] CRUD operations work
- [ ] State machine transitions work
- [ ] Mobile responsive
- [ ] Error handling works
- [ ] Toast notifications show
- [ ] Forms validate properly

---

## 📞 Support

**Backend Issues:** Check `backend/README.md`
**Deployment:** Check `DEPLOY_RENDER.md` or `DEPLOY_VPS.md`
**API Reference:** Check main `README.md`

---

## 🎉 You're All Set!

Your frontend is ready to connect to the backend. Start the dev server and begin building!

```bash
npm run dev
```

Visit http://localhost:3000 and login with demo credentials.

**Happy coding!** 🚀
