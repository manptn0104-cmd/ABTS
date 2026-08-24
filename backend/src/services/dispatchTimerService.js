const timers = new Map();

/**
 * Start a timer for a booking.
 */
const startTimer = (bookingId, callback, delay) => {
    // Remove old timer if it exists
    stopTimer(bookingId);

    const timer = setTimeout(callback, delay);

    timers.set(bookingId.toString(), timer);

    console.log(
        `[Timer] Started for booking ${bookingId}`
    );
};

/**
 * Stop timer
 */
const stopTimer = (bookingId) => {

    const timer = timers.get(bookingId.toString());

    if (timer) {

        clearTimeout(timer);

        timers.delete(bookingId.toString());

        console.log(
            `[Timer] Cleared for booking ${bookingId}`
        );
    }

};

module.exports = {
    startTimer,
    stopTimer,
};