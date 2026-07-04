with open('frontend/src/screens/Booking/BookingConfirmationScreen.js', 'r') as f:
    content = f.read()

# Since I messed it up, let me just checkout the file from before I broke it, and re-patch it properly.
import os
os.system("git checkout HEAD~2 -- frontend/src/screens/Booking/BookingConfirmationScreen.js")
