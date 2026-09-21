INSERT INTO room_types (hotel_id, name, description, base_price, max_occupancy, amenities) VALUES 
('aa4aeac5-e73b-4f6e-b7c4-b439170d831d', 'Standard Room', 'Comfortable standard room', 100, 2, '["TV", "WiFi"]'),
('aa4aeac5-e73b-4f6e-b7c4-b439170d831d', 'Deluxe Room', 'Spacious deluxe room with view', 180, 2, '["TV", "WiFi", "AC"]'),
('aa4aeac5-e73b-4f6e-b7c4-b439170d831d', 'Luxury Suite', 'Ultra-luxury suite with premium amenities', 350, 4, '["TV", "WiFi", "AC", "Minibar"]')
ON CONFLICT (hotel_id, name) DO NOTHING;

-- Also seed some rooms so they can actually book
INSERT INTO rooms (hotel_id, room_type_id, room_number, floor, status)
SELECT 'aa4aeac5-e73b-4f6e-b7c4-b439170d831d', id, '10' || row_number() OVER (), 1, 'AVAILABLE'
FROM room_types
WHERE hotel_id = 'aa4aeac5-e73b-4f6e-b7c4-b439170d831d'
ON CONFLICT DO NOTHING;
