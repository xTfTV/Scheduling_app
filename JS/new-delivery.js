function qs(k) {
    return new URLSearchParams(window.location.search).get(k);
}

function toMySQLDateTime(dateISO, timeHHMM) {
    return `${dateISO} ${timeHHMM}:00`;
}

async function fetchMe() {
    const res = await fetch("/API/is_logged_in");
    if(!res.ok) return null;
    return await res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
    const me = await fetchMe();

    // Only the admin/scheduler can create deliveries
    const canCreate = !!(me && (me.role === "admin" || me.role === "scheduler"));

    // Logout
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await fetch("/API/logout", { method: "POST" });
            } finally {
                window.location.href = "/login.html";
            }
        });
    }

    // Read the slot info from URL (sent from index.js)
    const date = qs("date");
    const time = qs("time");
    const userId = qs("user_id");
    const driverName = qs("driver_name") || "";
    const returnTo = qs("returnTo") || "/index.html";

    // Back/Cancel buttons go back correctly
    const btnBack = document.getElementById("btnBack");
    const btnCancel = document.getElementById("btnCancel");
    if (btnBack) btnBack.href = returnTo;
    if (btnCancel) btnCancel.href = returnTo;

    // Fill in the chips and autofilled inputs
    const chipWhen = document.getElementById("chipWhen");
    const scheduledDate = document.getElementById("scheduledDate");
    const assignedDriver = document.getElementById("assignedDriver");
    const assignedDriverId = document.getElementById("assignedDriverId");

    const whenText = (date && time) ? `${date} @ ${time}` : "-";
    if (chipWhen) chipWhen.textContent = whenText;
    if (scheduledDate) scheduledDate.value = whenText;
    if (assignedDriver) assignedDriver.value = driverName || "-";
    if (assignedDriverId) assignedDriverId.value = userId || "-";

    // Address autofill: customer -> delivery
    const cAddr = document.querySelector('[name="cust_address"]');
    const cCity = document.querySelector('[name="cust_city"]');
    const cZip = document.querySelector('[name="cust_zip"]');

    const dAddr = document.querySelector('[name="del_address"]');
    const dCity = document.querySelector('[name="del_city"]');
    const dZip = document.querySelector('[name="del_zip"]');

    const touched = { addr: false, city: false, zip: false };
    dAddr.addEventListener("input", () => (touched.addr = true));
    dCity.addEventListener("input", () => (touched.city = true));
    dZip.addEventListener("input", () => (touched.zip = true));

    function syncDeliveryAddress() {
        if (!touched.addr && !dAddr.value.trim()) dAddr.value = cAddr.value.trim();
        if (!touched.city && !dCity.value.trim()) dCity.value = cCity.value.trim();
        if (!touched.zip && !dZip.value.trim()) dZip.value = cZip.value.trim();
    }

    [cAddr, cCity, cZip].forEach(el => el.addEventListener("blur", syncDeliveryAddress));

    // Enable/disable submit based on role
    const submitBtn = document.querySelector('button[type="submit"][form="deliveryForm"]');
    if (submitBtn) submitBtn.disabled = !canCreate;

    // Submit create
    const form = document.getElementById("deliveryForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!canCreate) {
            alert("Only admin/scheduler can create deliveries.");
            return;
        }

        if (!date || !time || !userId) {
            alert("Missing slot info (date/time/driver). Go back and click a slot again.");
            return;
        }

        const data = Object.fromEntries(new FormData(form).entries());

        // Add required delivery fields from URL
        data.user_id = Number(userId);
        data.scheduled_time = toMySQLDateTime(date, time);
        data.duration_min = 60;

        const res = await fetch("/API/deliveries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            alert(await res.text());
            return;
        }

        window.location.href = returnTo;
    });
});