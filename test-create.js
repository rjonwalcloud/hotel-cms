async function test() {
    try {
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hotelcms.com', password: 'Admin@123' })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.message || 'Login failed');

        console.log('Login successful');
        const token = loginData.token;

        // List hotels
        const hotelsRes = await fetch('http://localhost:5000/api/hotels', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const hotelsData = await hotelsRes.json();

        let hotelId;
        if (hotelsData.hotels && hotelsData.hotels.length > 0) {
            hotelId = hotelsData.hotels[0].id;
        } else {
            console.log('No hotel found, creating one...');
            const newHotelRes = await fetch('http://localhost:5000/api/hotels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: 'Test Hotel', city: 'Test City', country: 'Test Country' })
            });
            const newHotelData = await newHotelRes.json();
            hotelId = newHotelData.hotel.id;
        }

        console.log('Using hotel ID:', hotelId);

        // List categories
        const catRes = await fetch(`http://localhost:5000/api/services/categories/hotel/${hotelId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const catData = await catRes.json();

        let categoryId;
        if (catData.categories && catData.categories.length > 0) {
            categoryId = catData.categories[0].id;
        } else {
            console.log('No category found, creating one...');
            const newCatRes = await fetch('http://localhost:5000/api/services/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ hotel_id: hotelId, name: 'Food', description: 'Food items' })
            });
            const newCatData = await newCatRes.json();
            categoryId = newCatData.category.id;
        }

        console.log('Using category ID:', categoryId);

        // Create item with max_quantity
        console.log('Attempting to create first item (with max_quantity)');
        const itemReq1 = await fetch('http://localhost:5000/api/services/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                hotel_id: hotelId,
                category_id: categoryId,
                name: 'TestItem1',
                description: 'Test Description',
                price: 10.99,
                max_quantity: 5
            })
        });
        const itemData1 = await itemReq1.json();
        console.log('Response 1:', itemReq1.status, itemData1);

        // Create item with empty max_quantity (as UI sends it)
        console.log('Attempting to create second item (with empty max_quantity)');
        const itemReq2 = await fetch('http://localhost:5000/api/services/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                hotel_id: hotelId,
                category_id: categoryId,
                name: 'TestItem2',
                description: 'Test Description',
                price: 15.99,
                max_quantity: ''
            })
        });
        const itemData2 = await itemReq2.json();
        console.log('Response 2:', itemReq2.status, itemData2);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
