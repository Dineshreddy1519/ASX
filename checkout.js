// ==========================================================================
// 1. INITIALIZE FIREBASE ENGINE
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyB6P-f32JPA2lvHXHbKksmRWLtNGGYtIPU",
    authDomain: "asx-motodrom.firebaseapp.com",
    projectId: "asx-motodrom",
    storageBucket: "asx-motodrom.firebasestorage.app",
    messagingSenderId: "709132385040",
    appId: "1:709132385040:web:0d9240e96ad94784eec395",
    measurementId: "G-E3V4R4E9DD"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================================================
// 2. RUNTIME PAGE OBSERVERS
// ==========================================================================
window.addEventListener("load", () => {
    const preloader = document.getElementById("preloader");
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add("fade-out");
        }, 1800); 
    }
});

// ==========================================================================
// REAL-TIME KOLKATA (IST) VALDIATION ENGINE
// ==========================================================================
function fetchCurrentIST() {
    const localTime = new Date();
    const utcOffset = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    return new Date(utcOffset + (3600000 * 5.5)); // Hard-lock to +5:30 Offset
}

const istClock = fetchCurrentIST();

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Date Picker with year controls active
    const clientDatePicker = flatpickr("#bookDate", {
        theme: "dark",
        dateFormat: "Y-m-d",
        minDate: istClock, // Instantly blocks any past date in India
        onChange: function(selectedDates) {
            if (selectedDates.length === 0) return;
            
            const targetDate = selectedDates[0];
            const freshIST = fetchCurrentIST();
            
            const isTodayIST = targetDate.getDate() === freshIST.getDate() &&
                               targetDate.getMonth() === freshIST.getMonth() &&
                               targetDate.getFullYear() === freshIST.getFullYear();
            
            if (isTodayIST) {
                // Lock clock to current hour/minute onwards for today
                clientTimePicker.set("minTime", `${freshIST.getHours()}:${freshIST.getMinutes()}`);
            } else {
                // Unlock full 24-hour access for future dates
                clientTimePicker.set("minTime", "00:00");
            }
        }
    });

    // 2. Initialize Time Picker
    const clientTimePicker = flatpickr("#bookTime", {
        theme: "dark",
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K",
        minuteIncrement: 1
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, { threshold: 0.05, rootMargin: "0px 0px -30px 0px" });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

// ==========================================================================
// 3. INTERACTIVE OVERLAY CONTROLLERS
// ==========================================================================
let currentPackageName = "";
let transactionAmount = 499; 

function openCheckout(packageName) {
    currentPackageName = packageName;
    transactionAmount = 499; 
    
    document.getElementById('selectedPackageName').innerText = packageName;
    document.querySelector('input[name="payMode"][value="secure"]').checked = true;
    document.getElementById('spotWarning').style.display = 'none';
    document.getElementById('paySubmitBtn').querySelector('span').innerText = `PAY ₹499 VIA UPI`;
    
    // Explicitly set flex alignment properties via JS layout engine toggle
    const modal = document.getElementById('checkoutModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

function closeCheckout() {
    document.getElementById('checkoutModal').style.display = 'none';
    document.body.style.overflow = 'auto'; 
}

window.onclick = function(event) {
    if (event.target === document.getElementById('checkoutModal')) {
        closeCheckout();
    }
}

function updatePaymentMode() {
    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    const warningText = document.getElementById('spotWarning');
    const submitBtnSpan = document.getElementById('paySubmitBtn').querySelector('span');
    
    if (payMode === 'spot') {
        transactionAmount = 0; 
        warningText.style.display = 'block'; 
        submitBtnSpan.innerText = "CONFIRM BOOKING (PAY AT TRACK)";
    } else {
        transactionAmount = 499; 
        warningText.style.display = 'none'; 
        submitBtnSpan.innerText = `PAY ₹499 VIA UPI`;
    }
}

// ==========================================================================
// 4. MESSAGING SYSTEM PACKS
// ==========================================================================
document.getElementById('waDirectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('waName').value;
    const message = document.getElementById('waMessage').value;
    
    const waText = encodeURIComponent(`Hi ASX MotoDrome, I am ${name}.\n\n${message}`);
    const waNumber = "917624881965"; 
    window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
    document.getElementById('waDirectForm').reset();
});

// ==========================================================================
// 5. TRANSACTION STORAGE PIPELINE
// ==========================================================================
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const email = document.getElementById('custEmail').value;
    const rawDate = document.getElementById('bookDate').value;
    const rawTime = document.getElementById('bookTime').value;
    
    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    
    const payBtn = document.getElementById('paySubmitBtn');
    const payBtnSpan = payBtn.querySelector('span');
    
    payBtn.disabled = true;
    payBtnSpan.innerText = 'SAVING BOOKING...';

    const bookingPayload = {
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        preferredDate: rawDate,
        preferredTime: rawTime,
        packageName: currentPackageName,
        paymentMode: payMode,
        amountPaid: transactionAmount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (payMode === 'spot') {
            bookingPayload.status = "Confirmed - Pay on Spot";
            await db.collection("bookings").add(bookingPayload);
            alert('Booking Saved Successfully! See you on the dirt track.');
            closeCheckout();
            document.getElementById('paymentForm').reset();
            return;
        }

        bookingPayload.status = "Pending Payment";
        const docRef = await db.collection("bookings").add(bookingPayload);

        const options = {
            key: "rzp_test_qJYpXiWtdGR4DN", 
            amount: transactionAmount * 100, 
            currency: "INR",
            name: "ASX MotoDrome",
            description: currentPackageName,
            prefill: { name: name, email: email, contact: phone },
            theme: { color: "#d31225" },
            handler: async function (response) {
                await db.collection("bookings").doc(docRef.id).update({
                    status: "Secured Advance Confirmed",
                    razorpayPaymentId: response.razorpay_payment_id
                });
                alert(`Spot Secured Successfully! Payment ID: ${response.razorpay_payment_id}. See you on the dirt track!`);
                closeCheckout();
                document.getElementById('paymentForm').reset();
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error("Firestore Save Defect:", error);
        alert('Database transaction timeout. Check network status.');
    } finally {
        payBtn.disabled = false;
        if (payMode === 'spot') {
            payBtnSpan.innerText = "CONFIRM BOOKING (PAY AT TRACK)";
        } else {
            payBtnSpan.innerText = `PAY ₹499 VIA UPI`;
        }
    }
});