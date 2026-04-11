const publicService = require('../services/public.service');

class PublicController {

    /**
     * GET /api/public/hotels/:hotel_id
     */
    async getHotelInfo(req, res, next) {
        try {
            const { hotel_id } = req.params;
            const hotel = await publicService.getHotelInfo(hotel_id);

            res.json({
                success: true,
                hotel
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    /**
     * GET /api/public/availability
     * Query params: hotel_id, check_in, check_out, adults, rooms
     */
    async searchAvailability(req, res, next) {
        try {
            const { hotel_id, check_in, check_out, adults, children, rooms } = req.query;

            if (!hotel_id || !check_in || !check_out) {
                return res.status(400).json({
                    success: false,
                    message: 'hotel_id, check_in, and check_out are required parameters'
                });
            }

            const availabilityParams = {
                hotelId: hotel_id,
                checkIn: check_in,
                checkOut: check_out,
                adults: parseInt(adults) || 1,
                children: parseInt(children) || 0,
                rooms: parseInt(rooms) || 1
            };

            const result = await publicService.searchAvailability(availabilityParams);

            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    /**
     * POST /api/public/bookings
     */
    async createBooking(req, res, next) {
        try {
            const {
                hotel_id,
                room_type_id,
                check_in_date,
                check_out_date,
                guest_name,
                guest_email,
                guest_phone,
                adults,
                children,
                room_count
            } = req.body;

            if (!hotel_id || !room_type_id || !check_in_date || !check_out_date || !guest_name || !guest_phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required booking fields'
                });
            }

            const booking = await publicService.createBooking({
                hotelId: hotel_id,
                roomTypeId: room_type_id,
                checkIn: check_in_date,
                checkOut: check_out_date,
                guestName: guest_name,
                guestEmail: guest_email,
                guestPhone: guest_phone,
                adults: parseInt(adults) || 1,
                children: parseInt(children) || 0,
                roomCount: parseInt(room_count) || 1
            });

            res.status(201).json({
                success: true,
                message: 'Booking confirmed',
                booking
            });
        } catch (error) {
            if (error.message.includes('not available') || error.message.includes('Sold out')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * GET /api/public/bookings/:booking_ref
     */
    async getBooking(req, res, next) {
        try {
            const { booking_ref } = req.params;
            const booking = await publicService.getBookingByRef(booking_ref);

            res.json({
                success: true,
                booking
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    /**
     * POST /api/public/bookings/:booking_ref/cancel
     */
    async cancelBooking(req, res, next) {
        try {
            const { booking_ref } = req.params;
            const { guest_email } = req.body; // Basic auth check for MVP

            if (!guest_email) {
                return res.status(400).json({
                    success: false,
                    message: 'guest_email is required to cancel a booking'
                });
            }

            await publicService.cancelBooking(booking_ref, guest_email);

            res.json({
                success: true,
                message: 'Booking cancelled successfully',
                status: 'CANCELLED'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, message: error.message });
            }
            if (error.message.includes('Unauthorized')) {
                return res.status(401).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    /**
     * GET /api/public/system-configs
     */
    async getSystemConfigs(req, res, next) {
        try {
            const configs = await publicService.getSystemConfigs();
            res.json({
                success: true,
                configs
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new PublicController();
