# How to Deploy the Customer Booking Portal to Render

Now that the backend public APIs and the Next.js customer booking portal are structurally sound, you can easily host this new website on **Render** utilizing their robust Static Site or Web Service architecture.

Because the Admin Backend (`hotel-cms`) might be kept private or secured, the Next.js frontend is decoupled. Follow these steps.

## Step 1: Push to GitHub

First, you need to push the new `hotel-booking-web` folder up to a Git repository. 
You can either nest it in your current `hotel-cms` monolith repository, or create a brand new Git repo specifically for it.

```bash
git add hotel-booking-web/
git commit -m "Add Next.js public booking portal"
git push origin main
```

## Step 2: Configure Render Web Service

1. Log in to your Render Dashboard (dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect the GitHub repository containing the `hotel-booking-web` code.
4. **Configuration Settings:**
   * **Name:** `hotel-booking-web`
   * **Root Directory:** `hotel-booking-web` *(This tells Render to look inside the subfolder instead of the repo root!)*
   * **Environment:** `Node`
   * **Build Command:** `npm install && npm run build`
   * **Start Command:** `npm run start`

## Step 3: Connect Frontend to the Backend

By default, we set up `next.config.mjs` to proxy `/api/*` to `http://localhost:5000`. This works great for local development but won't work traversing the live internet on Render.

We need to dynamically tell Next.js where your live backend API is!

### 1) Update Next.js Configuration

Change `hotel-booking-web/next.config.mjs` to use an Environment Variable for the destination block:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // If BACKEND_URL is set (Production), use it. Otherwise default to localhost.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      }
    ]
  }
};

export default nextConfig;
```

### 2) Set Environment Variables in Render

Back in the Render dashboard for your newly created `hotel-booking-web` service:
1. Navigate to the **Environment** tab.
2. Add the following Environment Variables:

* **Key:** `BACKEND_URL`
* **Value:** `https://your-hotel-cms-backend.onrender.com` *(Replace this with the actual live URL of your backend! Ensure no trailing slash)*

* **Key:** `NEXT_PUBLIC_BACKEND_URL`
* **Value:** `https://your-hotel-cms-backend.onrender.com` *(Crucial for client-side browser fetches! Must match BACKEND_URL)*

* **Key:** `NEXT_PUBLIC_HOTEL_ID`
* **Value:** *(Paste the UUID of the Hotel you want to display on this frontend.)*

## Step 4: Go Live!

Save all settings and hit **Manual Deploy > Deploy latest commit** on Render. 

Render will download Node.js, install Lucide/Tailwind, compile the production Next.js build, and launch the server. Your customers can now navigate to the fast, SEO-friendly site, and all checkout API calls will seamlessly proxy over to your secured backend!
