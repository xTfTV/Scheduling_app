// Creating the login routes that direct to index.html
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const errorEl = document.getElementById("errorMsg");

    if (!form) {
        console.error("loginForm not found.");
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevents querystring login

        if (errorEl) errorEl.textContent = "";

        // Grab inputs by name since name="email"/name="password"
        const emailInput = form.elements.namedItem("email");
        const passInput = form.elements.namedItem("password");

        const email = (emailInput?.value || "").trim();
        const password = passInput?.value || "";

        if (!email || !password) {
            if (errorEl) errorEl.textContent = "Please enter your email and password.";
            return;
        }
        try {
            const res = await fetch("/API/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            // Server returns the check if this is a valid login
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.ok) {
                window.location.href = data.redirectTo || "/index.html";
            } else {
                if (errorEl) errorEl.textContent = data.message || "Invalid email or password.";
            }
        } catch (err) {
            console.error(err);
            if (errorEl) errorEl.textContent = "Server error. Please try again.";
        }
    });
});