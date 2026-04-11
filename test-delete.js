async function testDelete() {
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
        const hotelId = hotelsData.hotels[0].id;

        console.log('Using hotel ID:', hotelId);

        // List items
        const itemsRes = await fetch(`http://localhost:5000/api/services/items/hotel/${hotelId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const itemsData = await itemsRes.json();
        console.log('Fetched items:', itemsData.items.length);

        if (itemsData.items.length > 0) {
            const itemToDel = itemsData.items[0];
            console.log('Attempting to delete item:', itemToDel.id, itemToDel.name);
            const delRes = await fetch(`http://localhost:5000/api/services/items/${itemToDel.id}?hotel_id=${hotelId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const delData = await delRes.json();
            console.log('Delete response:', delRes.status, delData);
        } else {
            console.log('No items to delete.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

testDelete();
