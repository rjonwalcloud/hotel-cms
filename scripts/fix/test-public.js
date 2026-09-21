async function runTests() {
    console.log('--- Starting Public API Booking Flow Tests ---');

    try {
        // 1. Get Hotel ID
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hotelcms.com', password: 'Admin@123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const hotelsRes = await fetch('http://localhost:5000/api/hotels', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const hotelsData = await hotelsRes.json();
        const hotelId = hotelsData.hotels[0].id;
        console.log(`[TEST] Using Hotel ID: ${hotelId}`);

        // Dates
        const today = new Date();
        const checkIn = today.toISOString().split('T')[0];
        const checkOutDate = new Date(today);
        checkOutDate.setDate(today.getDate() + 2);
        const checkOut = checkOutDate.toISOString().split('T')[0];

        // 2. Search Availability
        console.log('\n[TEST] Searching Availability...');
        const searchRes = await fetch(`http://localhost:5000/api/public/availability?hotel_id=${hotelId}&check_in=${checkIn}&check_out=${checkOut}&adults=2&rooms=1`);
        const searchData = await searchRes.json();
        console.log('Search Results:', JSON.stringify(searchData, null, 2));

        if (!searchData.available_rooms || searchData.available_rooms.length === 0) {
            console.log('No rooms available, test aborting.');
            return;
        }

        const roomToBook = searchData.available_rooms[0];
        console.log(`\n[TEST] Selecting Room Type: ${roomToBook.name}, Available Count: ${roomToBook.available_count}`);

        // 3. Create Booking
        console.log('\n[TEST] Creating Booking...');
        const bookReq = {
            hotel_id: hotelId,
            room_type_id: roomToBook.id,
            check_in_date: checkIn,
            check_out_date: checkOut,
            guest_name: 'Jane Doe Customer',
            guest_email: 'jane@example.com',
            guest_phone: '555-123-4567',
            adults: 2,
            children: 0,
            room_count: 1
        };

        const bookRes = await fetch('http://localhost:5000/api/public/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookReq)
        });
        const bookData = await bookRes.json();
        console.log('Booking Result:', bookData);

        const bookingRef = bookData.booking?.booking_ref;

        if (bookingRef) {
            console.log(`\n[TEST] Successfully created booking reference: ${bookingRef}`);

            // 4. Look up booking
            console.log('\n[TEST] Looking up booking...');
            const lookRes = await fetch(`http://localhost:5000/api/public/bookings/${bookingRef}`);
            const lookData = await lookRes.json();
            console.log('Lookup Result:', lookData.booking?.status);

            // 5. Check Inventory dropping
            console.log('\n[TEST] Searching Availability again to verify inventory lock...');
            const searchRes2 = await fetch(`http://localhost:5000/api/public/availability?hotel_id=${hotelId}&check_in=${checkIn}&check_out=${checkOut}&adults=2&rooms=1`);
            const searchData2 = await searchRes2.json();
            const updatedRoom = searchData2.available_rooms.find(r => r.id === roomToBook.id);
            console.log(`Previous count: ${roomToBook.available_count} -> New count: ${updatedRoom.available_count}`);

            if (updatedRoom.available_count === roomToBook.available_count - 1) {
                console.log('✅ Inventory lock SUCCESSFUL');
            } else {
                console.log('❌ Inventory did not drop accurately');
            }

            // 6. Cancel Booking
            console.log('\n[TEST] Canceling booking to release inventory...');
            const cancelRes = await fetch(`http://localhost:5000/api/public/bookings/${bookingRef}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guest_email: 'jane@example.com' })
            });
            const cancelData = await cancelRes.json();
            console.log('Cancel Result:', cancelData);

            // 7. Check Inventory recovering
            console.log('\n[TEST] Searching Availability again to verify inventory release...');
            const searchRes3 = await fetch(`http://localhost:5000/api/public/availability?hotel_id=${hotelId}&check_in=${checkIn}&check_out=${checkOut}&adults=2&rooms=1`);
            const searchData3 = await searchRes3.json();
            const finalRoom = searchData3.available_rooms.find(r => r.id === roomToBook.id);
            console.log(`Count after cancel: ${finalRoom.available_count}`);

            if (finalRoom.available_count === roomToBook.available_count) {
                console.log('✅ Inventory release SUCCESSFUL');
            } else {
                console.log('❌ Inventory did not recover accurately');
            }

        }

    } catch (error) {
        console.error('Test Failed Exception:', error);
    }
}

runTests();
