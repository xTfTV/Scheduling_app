/*

// Creating the POST for the API to not show user/pass in the header
document.getElementById("loginForm").addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const res = await fetch('/API/login', {
        method: 'POST',
        headers: { 'Content-Type': 'applications/json' },
        body: JSON.stringify({ email, password })
    });
    if (res, ok) {
        window.location.href = '/index.html';
    } else {
        document.getElementById('errorMsg').textContent = 'Invalid email or password.';
    }
});

*/