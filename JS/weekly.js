// JS for the weekly view button for index.html
const startHour = 7;
const endHour = 20;
const intervalMinutes = 10;

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const demoDeliveries = [
    // Driver, date (yyyy--mm-dd), start (hh:mm 24h), durationMin, title, note, style
    {driver: "Driver C", date: "2025-12-29", start: "9:30", duration: 40, title: "Gayle Redavid", note: "EX Cust", style: "blue"},
    {driver: "Driver C", date: "2025-12-29", start: "10:10", duration: 20, title: "John Carson", note: "NEW Cust", style: "blue"},
    {driver: "Driver A", date: "2025-12-28", start: "8:00", duration: 90, title: "No Driver", note: "", style: "yellow"},
];

function pad2(n) { return String(n).padStart(2, "0"); }

function toISODate (d) {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${yyyy}-${mm}-${dd}`
}

function addDays (date, n) {
    const d = new Date(date);
    d.setDate(d.getDate()+n);
    return d;
}

function startOfWeekSunday (date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function formatTimeLabel(h24, m) {
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12raw = h24 % 12;
    const h12 = h12raw === 0 ? 12 : h12raw;
    return `${h12}:${pad2(m)} ${ampm}`;
}

function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h*60 + m;
}

function minutesToKey(mins) {
    const h = Math.floor(mins/60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
}

function buildTimes() {
    const times = [];
    for(let h = startHour; h < endHour; h++) {
        for(let m = 0; m < 60; m += intervalMinutes) {
            times.push({ h, m, label: formatTimeLabel(h,m), key: `${pad2(h)}:${pad2(m)}` });
        }
    }
    // 8 PM cutoff row
    times.push({ h:endHour, m:0, label: formatTimeLabel(endHour, 0), key: `${pad2(endHour)}:00` });
    return times;
}

function formatRangeLabel (weekStart) {
    const end = addDays(weekStart, 6);
    const opts = { month: "short", day: "numeric" };
    return `${weekStart.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}`;
}

function renderHeader (weekStart, driver) {
    const head = document.getElementById("weeklyHeadRow");
    const cols = [];
    cols.push(`<th class="sticky-col">Time</th>`);

    for(let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        cols.push(`
            <th>
                <div class="dayhead">
                    <div class="d1">${dayNames[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}</div>
                    <div class="d2">${driver}</div>
                </div>
            </th>
        `);
    }
    cols.push(`<th class="right-col">Notes</th>`);
    head.innerHTML = cols.join("");
}

function buildDeliveryMap (driver, weekStart) {
    const map = new Map(); 

    const weekDates = new Set(Array.from({length:7}), (_,i)=>toISODate(addDays(weekStart,i)));

    demoDeliveries.filter(d => d.driver === driver && weekDates.has(d.date))
        .forEach(d => {
            const startMin = timeToMinutes(d.start);
            const slots = Math.max(1, Math.ceil(d.duration / intervalMinutes));
            map.set(`${d.date}|${minutesToKey(startMin)}`, { ...d, slots });
        });
    return map;
}

function getWeekStartFromInput() {
    const weekOf = document.getElementById("weekOf");
    const raw = weekOf.value;

    const base = raw ? new Date(raw + "T00:00:00") : new Date();
    if(Number.isNaN(base.getTime())) return startOfWeekSunday(new Date());
    return startOfWeekSunday(base);
}

function renderWeeklyGrid() {
    const driver = document.getElementById("driver-select").value;
    const weekOfInput = document.getElementById("weekOf");
    const weekRange = document.getElementById("weekRange");

    const weekStart = getWeekStartFromInput();

    // Snap picker to Sunday
    weekOfInput.value = toISODate(weekStart);
    weekRange.textContent = formatRangeLabel(weekStart);

    renderHeader(weekStart, driver);

    const times = buildTimes();
    const tbody = document.getElementById("weeklyBody");
    const deliveryMap = buildDeliveryMap(driver, weekStart);

    // For rowspan skipping: track for each day column how many rows remain "coverd"
    const skip = Array(7).fill(0);

    tbody.innerHTML = times.map((t) => {
        const cells = [];

        // Sticky time col
        cells.push(`<td class="time">${t.label}</td>`);

        // 7 day columns
        for(let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const dateKey = toISODate(addDays(weekStart, dayIdx));

            if (skip[dayIdx] > 0) {
                skip[dayIdx]--;
                continue; // this row is covered by the rowspan above
            }
            const key = `${dateKey}|${t.key}`;
            const delivery = deliveryMap.get(key);

            if(delivery) {
                // rowspan based on duration
                const span = delivery.slots;
                skip[dayIdx] = span - 1;

                const cls = delivery.style === "yellow" ? "delivery is-yellow" : "delivery";
                cells.push(`
                    <td class="cellpad" rowspan="${span}">
                        <div class="${cls}">
                            <span>${delivery.title}<small>${delivery.note || ""}</small></span>
                            <span style="opacity: 0.85; font-weight: 900;">${delivery.start}</span>
                        </div>
                    </td>
                `);
            } else {
                // empty slot
                cells.push(`
                    <td>
                        <div class="slot" data-driver="${driver}" data-date="${dateKey}" data-time="${t.key}">
                            <a class="slot-link" href="#" aria-label="Create Delivery">+</a>
                        </div>
                    </td>
                `);
            }
        }

        // notes col
        cells.push(`
            <td class="right-col">
                <div class="slot">
                    <span class="muted">-</span>
                    <a class="slot-link" href="#" aria-label="Add note">+</a>
                </div>
            </td>    
        `);
        return `<tr>${cells.join("")}</tr>`
    }).join("");

    // Prevent jump for now
    document.addEventListener("click", (e) => {
        const a = e.target.closest(".slot-link");
        if (!a) return;
        e.preventDefault();
    }, { once: true });
}

function handlePrint() {
    // Set a meaningful print title (shows in printer header sometimes)
    const driver = document.getElementById("driver-select").value;
    const weekOf = document.getElementById("weekOf").value;
    document.title = `Weekly - ${driver} - ${weekOf}`;

    // Add css hook for print only tweaks
    document.body.classList.add("is-printing");

    // Open the printing dialog
    window.print();

    // Remove the hook after printing
    setTimeout(() => document.body.classList.remove("is-printing"), 250);
}

function init() {
    const driverSelect = document.getElementById("driver-select");
    const weekOf = document.getElementById("weekOf");

    const btnPrev = document.getElementById("btnPrevWeek");
    const btnNext = document.getElementById("btnNextWeek");
    const btnThis = document.getElementById("btnThisWeek");
    const btnPrint = document.getElementById("btnPrint");

    const btnGo = document.getElementById("btnGo");
    const jumpWeeks = document.getElementById("jumpWeeks");

    // Calling the print button
    btnPrint.addEventListener("click", handlePrint);

    // default = this weeks sunday
    const wk = startOfWeekSunday(new Date());
    weekOf.value = toISODate(wk);

    driverSelect.addEventListener("change", renderWeeklyGrid);
    weekOf.addEventListener("change", renderWeeklyGrid);

    btnPrev.addEventListener("click", () => {
        const weekStart = getWeekStartFromInput();
        weekOf.value = toISODate(addDays(weekStart, -7));
        renderWeeklyGrid();
    });

    btnNext.addEventListener("click", () => {
        const weekStart = getWeekStartFromInput();
        weekOf.value = toISODate(addDays(weekStart, 7));
        renderWeeklyGrid();
    });
    
    btnThis.addEventListener("click", () => {
        const now = startOfWeekSunday(new Date());
        weekOf.value = toISODate(now);
        renderWeeklyGrid();
    });

    btnGo.addEventListener("click", () => {
        const n = Number(jumpWeeks.value || 0);
        const weekStart = getWeekStartFromInput();
        weekOf.value = toISODate(addDays(weekStart, n*7));
        renderWeeklyGrid();
    });
    renderWeeklyGrid();
}

document.addEventListener("DOMContentLoaded", init);