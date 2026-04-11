const bulkBookingService = require('../services/bulk-booking.service');

class BulkBookingController {
    /**
     * Create a new Bulk Booking
     */
    async createBulkBooking(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const userId = req.user.id;

            if (!hotelId) {
                return res.status(400).json({ success: false, message: 'Hotel ID is required' });
            }

            const result = await bulkBookingService.createBulkBooking(req.body, userId, hotelId);

            res.status(201).json({
                success: true,
                message: 'Bulk booking created successfully with ' + result.childBookings.length + ' rooms.',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all Bulk Bookings for a hotel
     */
    async getBulkBookings(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;

            if (!hotelId) {
                return res.status(400).json({ success: false, message: 'Hotel ID is required' });
            }

            const bookings = await bulkBookingService.getBulkBookingsByHotel(hotelId, req.query);

            res.json({
                success: true,
                data: bookings
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a single Bulk Booking by ID
     */
    async getBulkBookingById(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const bookingId = req.params.id;

            if (!hotelId || !bookingId) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            const booking = await bulkBookingService.getBulkBookingById(bookingId, hotelId);

            if (!booking) {
                return res.status(404).json({ success: false, message: 'Bulk booking not found' });
            }

            res.json({
                success: true,
                data: booking
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update Bulk Booking Status
     */
    async updateStatus(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const bookingId = req.params.id;
            const userId = req.user.id;
            const { status, room_assignments = [], guest_details = [] } = req.body;

            if (!hotelId || !bookingId || !status) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            const updatedBooking = await bulkBookingService.updateBulkBookingStatus(
                bookingId,
                status,
                userId,
                hotelId,
                room_assignments,
                guest_details
            );

            res.json({
                success: true,
                message: 'Bulk booking status updated successfully',
                data: updatedBooking
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get combined invoice for a Bulk Booking
     */
    async getInvoice(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const bookingId = req.params.id;

            if (!hotelId || !bookingId) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            const invoice = await bulkBookingService.getCombinedInvoice(bookingId, hotelId);

            res.json({
                success: true,
                invoice
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update bulk billing (add discounts or extra charges)
     */
    async updateBilling(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const bookingId = req.params.id;

            if (!hotelId || !bookingId) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            await bulkBookingService.updateBulkBilling(bookingId, hotelId, req.body);

            res.json({
                success: true,
                message: 'Bulk booking billing updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Settle full payment and final check out
     */
    async settlePayment(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const bookingId = req.params.id;
            const { payment_method } = req.body;

            if (!hotelId || !bookingId || !payment_method) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            // Checkout effectively pushes status to CHECKED_OUT and pays out all invoices
            await bulkBookingService.settlePayment(bookingId, hotelId, payment_method);
            await bulkBookingService.updateBulkBookingStatus(bookingId, 'CHECKED_OUT', req.user.id, hotelId);

            res.json({
                success: true,
                message: 'Bulk booking payment settled and checked out successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BulkBookingController();
