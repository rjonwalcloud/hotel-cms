const db = require('./backend/src/config/database');

async function testQuery() {
  const hotelId = '01869389-72f8-4fcc-9dfa-64152011bdee'; // Dummy UUID, or we can just run the query without hotel_id for a dry run

  // Booking invoices
  let bookingQuery = `
    SELECT 
      b.id::text as id, 
      b.booking_ref as reference, 
      b.invoice_number, 
      b.guest_name, 
      b.payment_status::text as payment_status, 
      b.total_amount as amount, 
      r.room_number,
      b.created_at,
      'BOOKING' as type
    FROM bookings b
    LEFT JOIN rooms r ON r.id = b.room_id
  `;

  // Service request invoices (completed)
  let serviceQuery = `
    SELECT 
      sr.id::text as id, 
      COALESCE(sr.booking_ref, sr.guest_name) as reference, 
      sr.invoice_number, 
      sr.guest_name, 
      CASE WHEN sr.is_billed = true THEN 'PAID' ELSE 'NOT_PAID' END as payment_status,
      (sr.quantity * si.price) as amount, 
      r.room_number,
      sr.created_at,
      'SERVICE' as type
    FROM service_requests sr
    JOIN service_items si ON si.id = sr.service_item_id
    LEFT JOIN rooms r ON r.id = sr.room_id
    WHERE sr.status = 'COMPLETED'
  `;

  const combinedQuery = `
    SELECT * FROM (
      ${bookingQuery}
      UNION ALL
      ${serviceQuery}
    ) as combined_invoices
    ORDER BY created_at DESC
    LIMIT 5
  `;

  try {
    console.log('Running combined query...');
    const result = await db.query(combinedQuery);
    console.log('Success! Rows:', result.rows.length);
  } catch (error) {
    console.error('SQL Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testQuery();
