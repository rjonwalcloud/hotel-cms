const axios = require('axios');

async function debugInvoiceQuery() {
  try {
    console.log('Logging in to staging...');
    const authRes = await axios.post('https://hotel-cms-api.onrender.com/api/auth/login', {
      email: 'admin@hotelcms.com',
      password: 'Admin@123'
    });
    
    const token = authRes.data.token;
    const hotelId = authRes.data.user.hotel_id; 
    console.log('Login successful. Token acquired.');

    // We just want to call the endpoint from the frontend's perspective.
    // However, SuperAdmin needs activeHotelId, which we will just pull from one of the bookings/hotels.
    
    // Let's get hotels first
    const hotelsRes = await axios.get('https://hotel-cms-api.onrender.com/api/hotels', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const fallbackHotelId = hotelsRes.data.hotels[0].id;
    console.log('Using Hotel ID:', fallbackHotelId);

    // Call the invoices endpoint
    console.log('Calling /api/invoices/all');
    const invoicesRes = await axios.get(`https://hotel-cms-api.onrender.com/api/invoices/all?hotel_id=${fallbackHotelId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('SUCCESS! Invoices:', invoicesRes.data.length);
  } catch (err) {
    if (err.response) {
      console.error('API ERROR RESPONSE:', err.response.data);
    } else {
      console.error('NETWORK/CODE ERROR:', err.message);
    }
  }
}
debugInvoiceQuery();
