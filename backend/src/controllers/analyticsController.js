const Booking = require('../models/Booking');
const User = require('../models/User');
const Ambulance = require('../models/Ambulance');

// GET /api/admin/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const [
      statusCounts,
      revenueAgg,
      dailyBookings,
      emergencyTrends,
      topDrivers,
      responseTimeAgg,
    ] = await Promise.all([
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, revenue: { $sum: '$fare.total' } } },
      ]),
      Booking.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
      Booking.aggregate([
        { $group: { _id: '$emergencyType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$ambulance', trips: { $sum: 1 } } },
        { $sort: { trips: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'ambulances',
            localField: '_id',
            foreignField: '_id',
            as: 'ambulance',
          },
        },
        { $unwind: '$ambulance' },
        {
          $project: {
            driverName: '$ambulance.driverName',
            vehicleNumber: '$ambulance.vehicleNumber',
            trips: 1,
          },
        },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: { $in: ['confirmed', 'in_progress', 'completed'] },
            confirmedAt: { $exists: true },
          },
        },
        {
          $project: {
            responseMin: {
              $divide: [{ $subtract: ['$confirmedAt', '$createdAt'] }, 60000],
            },
          },
        },
        { $group: { _id: null, avgResponseMin: { $avg: '$responseMin' } } },
      ]),
    ]);

    const byStatus = statusCounts.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    const totalBookings = Object.values(byStatus).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      analytics: {
        totalBookings,
        completedRides: byStatus.completed || 0,
        cancelledRides: (byStatus.cancelled || 0) + (byStatus.rejected || 0),
        pendingBookings: byStatus.pending || 0,
        revenue: revenueAgg[0]?.revenue || 0,
        averageResponseTimeMin: Math.round(responseTimeAgg[0]?.avgResponseMin || 0),
        dailyBookings,
        emergencyTrends,
        topDrivers,
      },
    });
  } catch (error) {
    next(error);
  }
};
