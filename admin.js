// ==========================================================================
// 1. CONFIGURATION & STATE STORAGE
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
const auth = firebase.auth();

let cachedBookingsRegistry = [];
let inactivityTimer;
const INACTIVITY_LIMIT = 30 * 60 * 1000; // Exactly 30 Minutes Inactivity Boundary

const TRACK_PRICING_TABLE = {
    "Pro Drive Training": 999,
    "Obstacle Conqueror Challenge": 1799,
    "Obstacle Conqueror": 1799,
    "Full Throttle Experience": 3299,
    "Full Throttle": 3299,
    "Adventure Value Pack": 3999
};

// ==========================================================================
// 2. AUTHENTICATION & SECURITY MONITORS (30-MIN AUTO LOGOUT)
// ==========================================================================
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() => { bindSessionStateObserver(); })
    .catch((err) => { console.error("Security System Fault:", err); });

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (auth.currentUser) {
        inactivityTimer = setTimeout(() => {
            showGlobalLoginError("Session expired due to 30 minutes of inactivity. Secure authentication required.");
            triggerAdminLogout();
        }, INACTIVITY_LIMIT);
    }
}

function startInactivityMonitoring() {
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('click', resetInactivityTimer);
    window.addEventListener('scroll', resetInactivityTimer);
    resetInactivityTimer();
}

function stopInactivityMonitoring() {
    window.removeEventListener('mousemove', resetInactivityTimer);
    window.removeEventListener('keydown', resetInactivityTimer);
    window.removeEventListener('click', resetInactivityTimer);
    window.removeEventListener('scroll', resetInactivityTimer);
    clearTimeout(inactivityTimer);
}

function bindSessionStateObserver() {
    auth.onAuthStateChanged((user) => {
        const loginLayer = document.getElementById("adminLoginScreen");
        const dashboardLayer = document.getElementById("adminDashboardScreen");
        if (user) {
            loginLayer.style.display = "none";
            dashboardLayer.style.display = "block";
            bootLiveDataPipeline();
            startInactivityMonitoring();
        } else {
            loginLayer.style.display = "flex";
            dashboardLayer.style.display = "none";
            cachedBookingsRegistry = [];
            stopInactivityMonitoring();
        }
    });
}

// REMOVED RECAPTCHA TOKEN CHECK VALIDATION LAYERS COMPLETELY
document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;
    
    hideGlobalLoginError();

    auth.signInWithEmailAndPassword(email, password)
        .catch(() => { 
            showGlobalLoginError("Authentication Failed: Something is wrong with your username or security key."); 
        });
});

function triggerAdminLogout() { 
    auth.signOut(); 
}

function showGlobalLoginError(messageText) {
    const errorDiv = document.getElementById("loginErrorMessage");
    if (errorDiv) {
        errorDiv.innerText = messageText;
        errorDiv.style.display = "block";
    }
}

function hideGlobalLoginError() {
    const errorDiv = document.getElementById("loginErrorMessage");
    if (errorDiv) {
        errorDiv.style.display = "none";
        errorDiv.innerText = "";
    }
}

// ==========================================================================
// 3. SYNCHRONOUS REAL-TIME HOOKS
// ==========================================================================
function bootLiveDataPipeline() {
    db.collection("bookings")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
          cachedBookingsRegistry = [];
          snapshot.forEach((doc) => { cachedBookingsRegistry.push({ id: doc.id, ...doc.data() }); });
          calculateExecutiveMetrics();
          applyFiltersAndSort();
      });
}

// ==========================================================================
// 4. BALANCED CALCULATION LOOP
// ==========================================================================
function calculateExecutiveMetrics() {
    let totalCount = 0, cashInHand = 0, projectedGross = 0, outstandingSpotDues = 0;

    cachedBookingsRegistry.forEach((booking) => {
        const status = (booking.status || "").trim();
        if (status === "Pending Payment" || status === "") return;
        totalCount++;

        const normalizedPackage = (booking.packageName || "").trim();
        const baseCost = TRACK_PRICING_TABLE[normalizedPackage] || 0;
        const paidAdvance = Number(booking.amountPaid) || 0;

        if (status === "Secured Advance Confirmed") {
            cashInHand += paidAdvance;
            projectedGross += baseCost;
            outstandingSpotDues += (baseCost - paidAdvance);
        } else if (status === "Confirmed - Pay on Spot") {
            projectedGross += baseCost;
            outstandingSpotDues += baseCost;
        }
    });

    document.getElementById("statTotalBookings").innerText = totalCount;
    document.getElementById("statSecuredRevenue").innerText = `₹${cashInHand.toLocaleString('en-IN')}`;
    document.getElementById("statProjectedRevenue").innerText = `₹${projectedGross.toLocaleString('en-IN')}`;
    document.getElementById("statOnSpotBalance").innerText = `₹${outstandingSpotDues.toLocaleString('en-IN')}`;
}

// ==========================================================================
// 5. RENDER FILTER DRAWS WITH CLEAN TEXT (REMOVED ALL EMOJIS)
// ==========================================================================
function applyFiltersAndSort() {
    const statusKey = document.getElementById("filterStatus").value;
    const packageKey = document.getElementById("filterPackage").value;
    const sortOrder = document.getElementById("sortOrder").value;
    const tableBody = document.getElementById("trackerTableStream");

    const dateInput = document.getElementById("filterDate");
    const dateKey = dateInput ? dateInput.value : "";

    let results = cachedBookingsRegistry.filter((b) => {
        return (statusKey === "all" || b.status === statusKey) &&
               (packageKey === "all" || b.packageName === packageKey) &&
               (dateKey === "" || b.preferredDate === dateKey);
    });

    results.sort((x, y) => {
        const tX = x.createdAt ? x.createdAt.seconds : 0;
        const tY = y.createdAt ? y.createdAt.seconds : 0;
        return sortOrder === "desc" ? (tY - tX) : (tX - tY);
    });

    document.getElementById("filteredCount").innerText = results.length;

    if (results.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-table-notice">No records match your active query filters.</td></tr>`;
        return;
    }

    let innerHTMLBuffer = "";
    results.forEach((booking) => {
        let badgeTheme = "tag-pending";
        if (booking.status === "Secured Advance Confirmed") badgeTheme = "tag-secured";
        if (booking.status === "Confirmed - Pay on Spot") badgeTheme = "tag-spot";

        const baseCost = TRACK_PRICING_TABLE[booking.packageName] || 0;
        const upfrontPaid = Number(booking.amountPaid || 0);
        const outstandingDues = booking.status === "Pending Payment" ? 0 : (baseCost - upfrontPaid);

        // CLEAN OUT ALL GRAPHIC EMOJIS IN FAVOR OF STANDARD HIGH-CONTRAST TYPOGRAPHY LABELS
        innerHTMLBuffer += `
            <tr class="tracker-data-row">
                <td style="width: 25%;">
                    <div class="driver-primary-label">${escapeText(booking.customerName)}</div>
                    <div class="driver-sub-labels">Phone: ${booking.customerPhone}<br>Email: ${escapeText(booking.customerEmail)}</div>
                </td>
                <td style="width: 20%;"><span class="table-package-pill">${booking.packageName}</span></td>
                <td style="width: 18%;">
                    <div class="table-date-string">Date: ${booking.preferredDate}</div>
                    <div class="table-time-string">Time: ${booking.preferredTime}</div>
                </td>
                <td style="width: 15%;">
                    <div class="finance-metrics-wrapper">
                        <div>Gross: <strong>₹${baseCost}</strong></div>
                        <div class="dues-split">Paid: ₹${upfrontPaid} | Bal: ₹${outstandingDues}</div>
                    </div>
                </td>
                <td style="width: 14%;"><span class="status-badge-bubble ${badgeTheme}">${booking.status}</span></td>
                <td style="width: 8%; text-align: center;">
                    <button onclick="dropBookingInstance('${booking.id}', '${booking.customerName.replace(/'/g, "\\'")}')" class="drop-action-btn">DROP</button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = innerHTMLBuffer;
}

// ==========================================================================
// 6. BRIEF REPORT PRINTER ENGINE WITH LOGO1.PNG (REMOVED EMOJIS)
// ==========================================================================
function generateBriefReport() {
    const mainScreen = document.getElementById("adminDashboardScreen");
    if (!mainScreen) return;

    const reportHeader = document.createElement("div");
    reportHeader.className = "print-report-header";
    reportHeader.style.display = "none"; 

    const currentDateStamp = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

    reportHeader.innerHTML = `
        <img src="IMG/Logo1.png" alt="ASX Logo" class="print-logo">
        <div class="print-title">
            <h1>Track Briefing Report</h1>
            <p>Generated on: ${currentDateStamp} | Operations Overview</p>
        </div>
    `;

    mainScreen.insertBefore(reportHeader, mainScreen.firstChild);
    window.print();
    reportHeader.remove();
}

// ==========================================================================
// 7. INBOUND WALK-INS (GROUP BALANCES REMOVED COMPLETELY)
// ==========================================================================
function openManualBookingModal() { 
    document.getElementById("manualFormStatus").style.display = "none";
    document.getElementById("manualBookingModal").style.display = "flex"; 
}
function closeManualBookingModal() { 
    document.getElementById("manualBookingModal").style.display = "none"; 
}

document.getElementById("manualEntryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("manualSubmitBtn");
    const statusDiv = document.getElementById("manualFormStatus");
    
    btn.disabled = true;
    statusDiv.style.display = "none";

    const targetCustomerName = document.getElementById("manualName").value;
    const chosenPackage = document.getElementById("manualPackage").value;
    const paymentModeMode = document.getElementById("manualPayMode").value;
    const finalCalculatedAdvance = (paymentModeMode === "secure") ? 499 : 0;
    const determinedStatusStr = (paymentModeMode === "secure") ? "Secured Advance Confirmed" : "Confirmed - Pay on Spot";

    const payload = {
        customerName: targetCustomerName,
        customerPhone: document.getElementById("manualPhone").value,
        customerEmail: document.getElementById("manualEmail").value,
        preferredDate: document.getElementById("manualDate").value,
        preferredTime: document.getElementById("manualTime").value,
        packageName: chosenPackage,
        paymentMode: paymentModeMode,
        amountPaid: finalCalculatedAdvance,
        status: determinedStatusStr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("bookings").add(payload);
        closeManualBookingModal();
        document.getElementById("manualEntryForm").reset();
    } catch (err) {
        statusDiv.innerText = "Something went wrong while committing the manual entry row data.";
        statusDiv.style.display = "block";
    } finally {
        btn.disabled = false;
    }
});

async function dropBookingInstance(documentId, targetCustomerName) {
    if (confirm(`Are you sure you want to delete records for ${targetCustomerName}?`)) {
        try { 
            await db.collection("bookings").doc(documentId).delete(); 
        } catch (err) { 
            alert("Action Denied: Could not remove database row mapping."); 
        }
    }
}

function triggerCSVSelect() { document.getElementById("csvFileInput").click(); }

function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        const lines = e.target.result.split(/\r?\n/);
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].trim();
            if (!row) continue;
            const columns = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || row.split(',');
            if (columns.length < 7) continue;
            const clean = columns.map(val => val.replace(/^["']|["']$/g, '').trim());

            await db.collection("bookings").add({
                customerName: clean[1],
                customerPhone: clean[2].replace(/^'/, ''),
                packageName: clean[3],
                preferredDate: clean[4],
                preferredTime: clean[5],
                status: clean[6],
                amountPaid: Number(clean[7]) || 0,
                customerEmail: clean[8] || "walkin@asxmotodrome.com",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        event.target.value = "";
    };
    reader.readAsText(file);
}

flatpickr("#manualDate", { dateFormat: "Y-m-d", minDate: "today" });
flatpickr("#filterDate", { dateFormat: "Y-m-d" });
flatpickr("#manualTime", { enableTime: true, noCalendar: true, dateFormat: "h:i K" });

function escapeText(textStr) {
    if (!textStr) return "";
    const mappings = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
    return textStr.replace(/[&<>"']/g, (m) => mappings[m]);
}