async function debugInvoiceQuery() {
  try {
    console.log('Logging in to localhost:5000...');
    const authRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hotelcms.com',
        password: 'Admin@123'
      })
    });
    
    if (!authRes.ok) throw new Error('Login failed: ' + await authRes.text());
    
    const authData = await authRes.json();
    const token = authData.token;
    console.log('Login successful. Token acquired.');

    // Let's get hotels first
    const hotelsRes = await fetch('http://localhost:5000/api/hotels', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const hotelsData = await hotelsRes.json();
    const fallbackHotelId = hotelsData.hotels[0].id;
    console.log('Using Hotel ID:', fallbackHotelId);

    // Call the invoices endpoint
    console.log('Calling /api/invoices/all');
    const invoicesRes = await fetch(`http://localhost:5000/api/invoices/all?hotel_id=${fallbackHotelId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const invoicesData = await invoicesRes.json();
    
    if (!invoicesRes.ok) {
       console.error('API ERROR RESPONSE:', invoicesData);
    } else {
       console.log('SUCCESS! Invoices:', invoicesData.length);
    }
  } catch (err) {
    console.error('CODE ERROR:', err.message);
  }
}
debugInvoiceQuery();
