const form = document.querySelector("#loginForm");
const state = document.querySelector("#loginState");
const button = document.querySelector("#loginButton");

form.addEventListener("submit", async event => {
  event.preventDefault();
  button.disabled = true;
  state.textContent = "Đang xác thực…";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.username.value, password: form.password.value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không đăng nhập được");
    location.replace("/");
  } catch (error) {
    state.textContent = error.message;
    form.password.value = "";
    form.password.focus();
  } finally { button.disabled = false; }
});
