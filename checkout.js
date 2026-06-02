// --- Scroll Animations ---
document.addEventListener("DOMContentLoaded", () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

// --- Modal & Payment Mode Logic ---
let currentPackageName = "";
let transactionAmount = 499; // Default to Secure Spot Advance

function openCheckout(packageName) {
    currentPackageName = packageName;
    transactionAmount = 499; 
    
    document.getElementById('selectedPackageName').innerText = packageName;
    
    // Reset payment mode to 'Secure' every time the modal opens
    document.querySelector('input[name="payMode"][value="secure"]').checked = true;
    document.getElementById('spotWarning').style.display = 'none';
    document.getElementById('paySubmitBtn').querySelector('span').innerText = `PAY ₹499 VIA UPI`;
    
    document.getElementById('checkoutModal').style.display = 'flex';
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

// Handles switching between Secure Spot (499) and Spot Registration (0)
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

// --- Helper Utility: Converts 24h Time code into 12h AM/PM string ---
function formatTimeTo12Hour(timeString) {
    if (!timeString) return "";
    let [hours, minutes] = timeString.split(":");
    hours = parseInt(hours, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert '0' hours to '12'
    return `${hours}:${minutes} ${ampm}`;
}

// --- WhatsApp Direct Contact Form Logic ---
document.getElementById('waDirectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('waName').value;
    const message = document.getElementById('waMessage').value;
    
    const waText = encodeURIComponent(`Hi ASX MotoDrome, I am ${name}.\n\n${message}`);
    const waNumber = "919876543210"; 
    window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
    document.getElementById('waDirectForm').reset();
});

// --- Payment Form Submission to Django ---
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const email = document.getElementById('custEmail').value;
    
    // Capturing split fields independently
    const rawDate = document.getElementById('bookDate').value;
    const rawTime = document.getElementById('bookTime').value;
    
    // Formatting the output time value into 12-hour system 
    const time12Hour = formatTimeTo12Hour(rawTime);
    const combinedDateTimeString = `${rawDate} ${time12Hour}`; // Looks like: "2026-06-02 03:30 PM"

    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    const payBtn = document.getElementById('paySubmitBtn');
    const payBtnSpan = payBtn.querySelector('span');
    
    payBtn.disabled = true;
    payBtnSpan.innerText = 'SECURING SLOT...';

    const packageDescription = payMode === 'spot' 
        ? `${currentPackageName} (Pay on Spot)` 
        : `${currentPackageName} (Secured Advance)`;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/create-order/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                amount: transactionAmount, 
                package: packageDescription,
                name: name, 
                phone: phone, 
                email: email, 
                date: combinedDateTimeString, 
                pay_mode: payMode 
            })
        });
        
        const data = await response.json();

        if (!data.success) {
            alert(`Booking Failed: ${data.error}\n(Check your terminal for exact details).`);
            return;
        }

        if (data.payment_required === false) {
            alert('Booking Confirmed! You have selected to Pay on the Spot. See you at the dirt track!');
            closeCheckout();
            document.getElementById('paymentForm').reset();
            return;
        }

        const options = {
            key: "YOUR_TEST_KEY_ID", 
            amount: data.amount,
            currency: data.currency,
            name: "ASX MotoDrome",
            description: packageDescription,
            order_id: data.order_id,
            handler: function (response) {
                alert(`Spot Secured Successfully! Payment ID: ${response.razorpay_payment_id}. See you on the dirt track!`);
                closeCheckout();
                document.getElementById('paymentForm').reset();
            },
            prefill: { name, email, contact: phone },
            theme: { color: "#ff0000" }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
            alert('Payment Failed: ' + response.error.description);
        });
        rzp.open();

    } catch (error) {
        console.error("Connection Error:", error);
        alert('Server unreachable. Make sure your Django backend is running on port 8000.');
    } finally {
        resetButton();
    }
});

function resetButton() {
    const payBtn = document.getElementById('paySubmitBtn');
    const payBtnSpan = payBtn.querySelector('span');
    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    
    payBtn.disabled = false;
    if (payMode === 'spot') {
        payBtnSpan.innerText = "CONFIRM BOOKING (PAY AT TRACK)";
    } else {
        payBtnSpan.innerText = `PAY ₹499 VIA UPI`;
    }
}