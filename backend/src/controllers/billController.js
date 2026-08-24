const Bill = require('../models/Bill');
const Booking = require('../models/Booking');
const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { calculateFareFromBooking, generateReceiptNumber } = require('../utils/fareCalculator');

/**
 * Generate bill for a completed booking
 * Automatically called when booking status changes to 'completed'
 * @route POST /api/bills/generate/:bookingId
 */
exports.generateBill = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    // Find booking and populate related data
    const booking = await Booking.findById(bookingId)
      .populate('user', 'name phone email')
      .populate('ambulance')
      .populate('driver', 'name phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Bill can only be generated for completed bookings.' 
      });
    }

    // Check if bill already exists for this booking
    const existingBill = await Bill.findOne({ bookingId });
    if (existingBill) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bill already generated for this booking.',
        bill: existingBill 
      });
    }

    // Calculate fare
    const fareBreakdown = calculateFareFromBooking(booking);

    // Get ambulance details
    const ambulance = await Ambulance.findById(booking.ambulance._id);
    const driver = await User.findById(ambulance.owner);

    // Create bill document
    const bill = await Bill.create({
      receiptNumber: generateReceiptNumber(),
      bookingId: booking._id,
      patientId: booking.user._id,
      driverId: driver._id,
      ambulanceId: ambulance._id,
      
      // Patient details
      patientName: booking.patientDetails?.name || booking.user.name,
      
      // Driver details
      driverName: driver.name,
      
      // Ambulance details
      ambulanceNumber: ambulance.vehicleNumber,
      
      // Ride details
      pickupAddress: booking.pickupLocation?.address || 'Unknown',
      dropAddress: booking.dropLocation?.address || 'Unknown',
      rideDistanceKm: booking.estimatedDistance || 0,
      
      // Pricing
      baseFare: fareBreakdown.baseFare,
      pricePerKm: fareBreakdown.pricePerKm,
      distanceCharge: fareBreakdown.distanceCharge,
      
      // Facility charges
      oxygenCharge: fareBreakdown.oxygenCharge,
      salineCharge: fareBreakdown.salineCharge,
      stretcherCharge: fareBreakdown.stretcherCharge,
      nurseCharge: fareBreakdown.nurseCharge,
      doctorCharge: fareBreakdown.doctorCharge,
      ventilatorCharge: fareBreakdown.ventilatorCharge,
      defibrillatorCharge: fareBreakdown.defibrillatorCharge,
      
      // Other charges
      waitingCharge: fareBreakdown.waitingCharge,
      tollCharge: fareBreakdown.tollCharge,
      
      // Totals
      subtotal: fareBreakdown.subtotal,
      gst: fareBreakdown.gst,
      gstPercentage: fareBreakdown.gstPercentage,
      totalAmount: fareBreakdown.totalAmount,
      
      // Payment
      paymentMethod: booking.paymentMethod || 'cash',
      paymentStatus: 'pending',
      
      // Audit
      generatedBy: req.user._id,
    });

    res.status(201).json({ 
      success: true, 
      message: 'Bill generated successfully.', 
      bill 
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get bill by ID
 * @route GET /api/bills/:id
 */
exports.getBill = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id)
      .populate('bookingId')
      .populate('patientId', 'name phone email')
      .populate('driverId', 'name phone')
      .populate('ambulanceId', 'vehicleNumber type');

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found.' });
    }

    // Authorization check: only patient, driver, or admin can view
    const isPatient = bill.patientId._id.toString() === req.user.id;
    const isDriver = bill.driverId._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDriver && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this bill.' 
      });
    }

    res.json({ success: true, bill });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all bills for a user (patient)
 * @route GET /api/bills/user
 */
exports.getBillByBooking = async (req, res) => {
  try {
    const bill = await Bill.findOne ({ bookingId: req.params.bookingId,});
    if (!bill) {
      return res.status(404).json({
               success:false,
               message:"Bill not found",
      });
    }
    res.json({ success:true, bill,});
  } catch (err){
    res.status(500).json({ success:false, message:err.message,});
  }
};

exports.getBillsByUser = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { patientId: req.user.id };
    if (status) query.paymentStatus = status;

    const bills = await Bill.find(query)
      .populate('ambulanceId', 'vehicleNumber type')
      .populate('driverId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Bill.countDocuments(query);

    res.json({ 
      success: true, 
      bills, 
      total, 
      page: parseInt(page), 
      pages: Math.ceil(total / limit) 
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all bills for a driver
 * @route GET /api/bills/driver
 */
exports.getBillsByDriver = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { driverId: req.user.id };
    if (status) query.paymentStatus = status;

    const bills = await Bill.find(query)
      .populate('patientId', 'name phone')
      .populate('ambulanceId', 'vehicleNumber type')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Bill.countDocuments(query);

    // Calculate driver earnings
    const earnings = await Bill.aggregate([
      { $match: { driverId: req.user._id, paymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$totalAmount' },
          totalTrips: { $sum: 1 },
        },
      },
    ]);

    res.json({ 
      success: true, 
      bills, 
      total, 
      page: parseInt(page), 
      pages: Math.ceil(total / limit),
      earnings: earnings[0] || { totalEarnings: 0, totalTrips: 0 },
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Download receipt as PDF (placeholder - would need PDF library)
 * @route GET /api/bills/:id/pdf
 */
exports.downloadReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id)
      .populate('bookingId')
      .populate('patientId', 'name phone email')
      .populate('driverId', 'name phone')
      .populate('ambulanceId', 'vehicleNumber type');

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found.' });
    }

    // Authorization check
    const isPatient = bill.patientId._id.toString() === req.user.id;
    const isDriver = bill.driverId._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDriver && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to download this receipt.' 
      });
    }

    // For now, return JSON data that can be used to generate PDF on frontend
    // In production, use a library like pdfkit or puppeteer to generate actual PDF
    res.json({ 
      success: true, 
      message: 'Receipt data retrieved. Use frontend to generate PDF.',
      receiptData: bill 
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get revenue statistics for admin dashboard
 * @route GET /api/bills/stats
 */
exports.getRevenueStats = async (req, res, next) => {
  try {
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'month') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: monthStart } };
    }

    // Total revenue
    const totalRevenue = await Bill.aggregate([
      { $match: { ...dateFilter, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    // Completed trips
    const completedTrips = await Bill.countDocuments(dateFilter);

    // Cancelled trips (from bookings)
    const cancelledTrips = await Booking.countDocuments({
      status: 'cancelled',
      createdAt: dateFilter.createdAt,
    });

    // Driver earnings
    const driverEarnings = await Bill.aggregate([
      { $match: { ...dateFilter, paymentStatus: 'paid' } },
      {
        $group: {
          _id: '$driverId',
          totalEarnings: { $sum: '$totalAmount' },
          trips: { $sum: 1 },
        },
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 1 },
    ]);

    // Most booked ambulance
    const mostBookedAmbulance = await Bill.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$ambulanceId',
          bookings: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { bookings: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'ambulances', localField: '_id', foreignField: '_id', as: 'ambulance' } },
      { $unwind: '$ambulance' },
    ]);

    res.json({
      success: true,
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        completedTrips,
        cancelledTrips,
        topDriver: driverEarnings[0] || null,
        topAmbulance: mostBookedAmbulance[0] || null,
      },
    });

  } catch (error) {
    next(error);
  }
};
