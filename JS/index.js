// Layout Grid Generator

const drivers = ["Driver A", "Driver B", "Driver C", "Driver D"];
const startHour = 7;
const endHour = 20;
const intervalMinutes = 60;

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

function renderGrid() {
    const tbody = document.getElementById("scheduleBody");
    const times =  buildTimes();

    tbody.innerHTML = times.map((t, rowIdx) => {
        const timeKey = `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;

        // Visual demo only
        const demoBooked = (t.h === 9 && t.m === 0);

        const driverCells = drivers.map((d, colIdx) =>{
            const cellId = `slot-${timeKey}-${colIdx}`;

            return `
                <td>
                    <div class="slot" data-time="${timeKey}" data-driver="${d}">
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
                        <a class="slot-link" href="#" aria-label="Add note">+</a>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
    renderGrid();

    // Layout only -- preventing page jump when clicking +
    document.addEventListener("click", (e) => {
        const a = e.target.closest(".slot-link");
        if (!a) return;
        e.preventDefault();
    });
});