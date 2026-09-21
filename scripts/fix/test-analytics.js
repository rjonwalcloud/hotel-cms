const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const API_URL = 'http://localhost:5000/api';

async function testAnalytics() {
  try {
    // 1. Login to get token and hotelId
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'hoteladmin1@grandhotel.com',
      password: 'Password123'
    });
    
    const token = loginRes.data.token;
    const hotelId = loginRes.data.user.roles[0].hotel_id;
    console.log('Hotel ID:', hotelId);

    const config = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Test Summary
    console.log('\nTesting Summary (Daily)...');
    try {
      const summaryRes = await axios.get(`${API_URL}/analytics/${hotelId}/summary?year=2026&month=3`, config);
      console.log('Summary Result:', summaryRes.data);
    } catch (e) {
      console.error('Summary Error:', e.response?.data || e.message);
    }

    // 3. Test Charts
    console.log('\nTesting Charts (Daily)...');
    try {
      const chartRes = await axios.get(`${API_URL}/analytics/${hotelId}/charts?period=daily&year=2026&month=3`, config);
      console.log('Chart Result Points:', chartRes.data.length);
    } catch (e) {
      console.error('Charts Error:', e.response?.data || e.message);
    }

    // 4. Test Annual (Full Year)
    console.log('\nTesting Charts (Annual)...');
    try {
      const annualRes = await axios.get(`${API_URL}/analytics/${hotelId}/charts?period=monthly&year=2026`, config);
      console.log('Annual Result Points:', annualRes.data.length);
    } catch (e) {
      console.error('Annual Error:', e.response?.data || e.message);
    }

  } catch (error) {
    console.error('Test Failed:', error.response?.data || error.message);
  }
}

testAnalytics();
