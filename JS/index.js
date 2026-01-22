// Layout Grid Generator

let drivers = [];
const startHour = 7;
const endHour = 20;
const intervalMinutes = 10;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let selectedDay = null;

let me = null;
let canEditDeliveries = false;

// Fetching the drivers via api call
async function fetchDrivers() {
    const res = await fetch("/API/drivers");
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to fetch the driver");
    }
    return await res.json();
}

function pad2(n) { return String(n).padStart(2, "0"); }

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
}

function toISODate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return startOfDay(d);
}

function formatTime(h24, m) {
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12raw = h24 % 12;
    const h12 = h12raw === 0 ? 12 : h12raw;
    const mm = String(m).padStart(2, "0");
    return `${h12}:${mm} ${ampm}`;
}

function buildTimes() {
    const times = [];

    // 7AM through 7PM
    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m+= intervalMinutes) {
            times.push({ h, m, label: formatTime(h, m) });
        }
    }

    // Cut off at 8pm exactly
    times.push({ h: endHour, m: 0, label: formatTime(endHour, 0) });

    return times;
}

// Rebuilding the driver columns based on how many drivers are entered
function renderDailyHeader() {
    const headRow = document.getElementById("dailyHeadRow");
    if (!headRow) return;

    // Keep the first TH (Time) and last TH (notes), replace everything in between
    const first = `<th class="sticky-col">Time</th>`;
    const driverThs = drivers.map(d => {
        const name = `${d.first_name} ${d.last_name}`.trim();
        return `<th data-user-id="${d.user_id}">${name}</th>`
    }).join("");
    const last = `<th class="right-col">Notes</th>`;

    headRow.innerHTML = first + driverThs + last;
}
// renderGrid function for the schedule
function renderGrid() {
    const tbody = document.getElementById("scheduleBody");
    const times =  buildTimes();

    tbody.innerHTML = times.map((t, rowIdx) => {
        const timeKey = `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;

        // Visual demo only
        const demoBooked = (t.h === 9 && t.m === 0);

        const driverCells = drivers.map((d, colIdx) =>{
            const cellId = `slot-${timeKey}-${d.user_id}`;

            const driverName = `${d.first_name} ${d.last_name}`.trim();

            return `
                <td>
                    <div class="slot" data-time="${timeKey}" data-user-id="${d.user_id}" data-driver-name="${driverName}">
                        ${demoBooked && colIdx === 2 ?  `<div class="booked">Inserted</div>` :  ``}
                        <a class="slot-link" href="#" aria-label="Create Delivery" data-slot="${cellId}">+</a> 
                    </div>
                </td>
            `;
        }).join("");

        return `
            <tr>
                <td class="time">${t.label}</td>
                ${driverCells}
                <td class="right-col">
                    <div class="slot">
                        <span class="muted">-</span>
                        <a class="slot-link" href="#" aria-label="Notes">+</a>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function setSelectedDay(newDay) {
    selectedDay = startOfDay(newDay);

    const dateInput = document.getElementById('dateInput');
    const dayLabel = document.getElementById('dayLabel');

    if (dateInput) dateInput.value = toISODate(selectedDay);
    if (dayLabel) dayLabel.textContent = dayNames[selectedDay.getDay()];

    // Temp re-render of the grid, later will add api to fetch deliveries
    renderGrid();
}

function scheduleMidnightRollover() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24,0,0,0);

    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
        // If the user is still on today, advance to the next day
        const today =  startOfDay(new Date());
        if(toISODate(selectedDay) === toISODate(today)) {
            setSelectedDay(addDays(selectedDay, 1));
        }
        scheduleMidnightRollover(); // keeps repeating
    }, msUntilMidnight);
}

async function fetchMe() {
    const res = await fetch("/API/is_logged_in");
    if (!res.ok) return null;
    return await res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
    me = await fetchMe();
    canEditDeliveries = !!(me && (me.role === "admin" || me.role === "scheduler"));

    const btnAdmin = document.getElementById("btnAdmin");

    if(btnAdmin) {
        if (me && me.role === "admin") {
            btnAdmin.style.display = "inline-flex";
            btnAdmin.addEventListener("click", () => {
                // sending admin to the user creation page
                window.location.href = "/user_creation.html";
            });
        } else {
            btnAdmin.style.display = "none";
        }
    }

    try {
        drivers = await fetchDrivers();
        renderDailyHeader();
        renderGrid();
    } catch (e) {
        console.error(e);
        alert("Could not load drivers. Check console.")
    }

    // Start on today's date once the page is loaded
    setSelectedDay(new Date());
    scheduleMidnightRollover();

    // Doing the hard reload when clicking the refresh button
    const btnRefresh = document.getElementById("btn-refresh");
    if(btnRefresh) {
        btnRefresh.addEventListener("click", () => {
            window.location.reload();
        });
    }
    
    // Prev and Next day buttons
    const btnPrev = document.getElementById("btnPrevDay");
    const btnNext = document.getElementById("btnNextDay");

    if(btnPrev) btnPrev.addEventListener("click", () => setSelectedDay(addDays(selectedDay, -1)));
    if(btnNext) btnNext.addEventListener("click", () => setSelectedDay(addDays(selectedDay, 1)));

    // Today button
    const btnToday = document.getElementById("btnToday");
    if (btnToday) btnToday.addEventListener("click", () => setSelectedDay(new Date()));

    // Date picker change
    const dateInput = document.getElementById("dateInput");
    if(dateInput) {
        dateInput.addEventListener("click", () => {
            const raw = dateInput.value; // YYYY-MM-DD
            if (!raw) return;
            const d = new Date(raw + "T00:00:00");
            if (!Number.isNaN(d.getTime())) setSelectedDay(d);
        });
    }

    // Calendar button (opens the browser date picker)
    const btnCalendar = document.getElementById("btnCalendar");
    if (btnCalendar && dateInput) {
        btnCalendar.addEventListener("click", () => {
            if(dateInput.showPicker) dateInput.showPicker();
            else dateInput.focus();
        });
    }

    // Jump ahead (days) + go button
    const btnGo = document.getElementById("btnGo");
    const jumpDays = document.getElementById("jumpDays");
    if (btnGo && jumpDays) {
        btnGo.addEventListener("click", () => {
            const n = Number(jumpDays.value || 0);
            setSelectedDay(addDays(selectedDay, n * 7));
        });
    }

    // Layout only -- preventing page jump when clicking +
    document.addEventListener("click", (e) => {
        const a = e.target.closest(".slot-link");
        if (!a) return;

        e.preventDefault();

        // Only scheduler/admin can create deliveries
        if (!canEditDeliveries) return;

        const slot = a.closest(".slot");
        if (!slot) return;

        // Only handling the driver slots not the notes
        const userId = slot.dataset.userId;
        const time = slot.dataset.time

        if (!userId || !time) return;

        const driverName = slot.dataset.driverName || "";

        // current shown date
        const dateISO = selectedDay ? toISODate(selectedDay) : toISODate(new Date());

        const params = new URLSearchParams({
            date: dateISO,
            time,
            user_id: String(userId),
            driver_name: driverName,
            returnTo: "/index.html"
        });
        window.location.href = `/new-delivery.html?${params.toString()}`;
    });
});

function init() {
    // temp position for the logout functionality
    const btnLogout = document.getElementById("btnLogout");
    if(btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                const res = await fetch("/API/logout", { method: "POST" });
                window.location.href = "/login.html";
            } catch (e) {
                window.location.href = "/login.html";
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", init);