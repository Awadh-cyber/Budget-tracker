import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// The publishable key is safe to put in a website. What it can do is
// controlled by the Row Level Security rules: each logged-in user can only
// reach their own expenses and their own receipts folder.
const SUPABASE_URL = "https://eqyiciekemnazoikuwyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_xQ0bTHefdQO6XipEOfWslw_3RZZnWyR";

// The session (JWT + refresh token) is kept in this browser and refreshed
// automatically before it expires, so a page reload keeps you logged in.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Receipt links stop working after 10 minutes; reloading the list makes new ones.
const RECEIPT_LINK_SECONDS = 600;

const appLoading = document.getElementById("app-loading");
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const account = document.getElementById("account");
const accountEmail = document.getElementById("account-email");
const logoutButton = document.getElementById("logout-button");

const authForm = document.getElementById("auth-form");
const authSubmit = document.getElementById("auth-submit");
const authMessage = document.getElementById("auth-message");
const passwordLabel = document.getElementById("password-label");
const togglePassword = document.getElementById("toggle-password");
const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const authSwitch = document.getElementById("auth-switch");
const authSwitchButton = document.getElementById("auth-switch-button");
const resend = document.getElementById("resend");
const resendButton = document.getElementById("resend-button");

const form = document.getElementById("expense-form");
const formMessage = document.getElementById("form-message");
const list = document.getElementById("expense-list");
const listMessage = document.getElementById("list-message");
const filter = document.getElementById("category-filter");

let expenses = [];
let currentUser = null;
let authMode = "login";

const kd = (n) => `${Number(n).toFixed(3)} KD`;
const todayISO = () => new Date().toLocaleDateString("en-CA");

form.spent_on.value = todayISO();

// ---------- Auth ----------

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === "login";
  loginTab.setAttribute("aria-selected", String(isLogin));
  signupTab.setAttribute("aria-selected", String(!isLogin));
  authSubmit.textContent = isLogin ? "Log in" : "Create account";
  authForm.password.autocomplete = isLogin ? "current-password" : "new-password";
  passwordLabel.textContent = isLogin ? "Password" : "Create password";
  // Name fields only show (and only count) when creating an account.
  for (const field of authForm.querySelectorAll("[data-signup-only]")) {
    field.hidden = isLogin;
    field.querySelector("input").disabled = isLogin;
  }
  authForm.first_name.required = !isLogin;
  authForm.last_name.required = !isLogin;
  authSwitch.firstChild.textContent = isLogin ? "No account yet? " : "Already have an account? ";
  authSwitchButton.textContent = isLogin ? "Create one" : "Log in";
  resend.hidden = true;
  showMessage(authMessage, "");
}

// Supabase sends an error code with each failure; turn it into plain words.
function friendlyAuthError(error) {
  const text = error.message || "";
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password. If you just signed up, make sure the account was created and confirmed first.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox (and spam) for the link.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with this email. Try logging in.";
    case "over_email_send_rate_limit":
      return "Your account was NOT created: Supabase can only send a few confirmation emails per hour and the limit is used up. Try again in about an hour.";
    case "email_address_not_authorized":
      return "Supabase's free email service can't send to this address. Use the email of your Supabase account, or ask the project owner to set up email sending.";
    case "email_address_invalid":
      return "That email address isn't accepted. Please use a real email address.";
    case "over_request_rate_limit":
      return "Too many tries from this device. Please wait a few minutes and try again.";
    case "weak_password":
      return "That password is too weak. Use at least 6 characters.";
  }
  if (/invalid login credentials/i.test(text)) return "Wrong email or password.";
  if (/email not confirmed/i.test(text)) return "Please confirm your email first. Check your inbox (and spam) for the link.";
  if (/already registered|already exists/i.test(text)) return "There's already an account with this email. Try logging in.";
  if (/rate limit|too many/i.test(text)) return "Too many tries. Please wait a few minutes and try again.";
  return `Something went wrong: ${text}`;
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = authForm.email.value.trim();
  const password = authForm.password.value;

  authSubmit.disabled = true;
  resend.hidden = true;
  showMessage(authMessage, authMode === "login" ? "Logging in…" : "Creating your account…");

  if (authMode === "login") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    authSubmit.disabled = false;
    if (error) {
      showMessage(authMessage, friendlyAuthError(error), true);
      resend.hidden = error.code !== "email_not_confirmed" && !/email not confirmed/i.test(error.message);
      return;
    }
    // onAuthStateChange shows the app.
    authForm.reset();
    return;
  }

  // Names are saved on the account itself (Supabase "user metadata").
  const firstName = authForm.first_name.value.trim();
  const secondName = authForm.second_name.value.trim();
  const lastName = authForm.last_name.value.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
      data: {
        first_name: firstName,
        second_name: secondName || null,
        last_name: lastName,
        full_name: [firstName, secondName, lastName].filter(Boolean).join(" "),
      },
    },
  });
  authSubmit.disabled = false;

  if (error) {
    showMessage(authMessage, friendlyAuthError(error), true);
    return;
  }

  // With email confirmation on, Supabase returns no session until the link is clicked.
  // An empty identities list means the email is already registered.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    showMessage(authMessage, "There's already an account with this email. Try logging in.", true);
    return;
  }
  if (!data.session) {
    showMessage(authMessage, `Almost done! We sent a confirmation link to ${email}. Open it, then log in here.`);
    resend.hidden = false;
    setAuthModeKeepMessage();
    return;
  }
  authForm.reset();
});

// Switch to the login tab without clearing the "check your email" message.
function setAuthModeKeepMessage() {
  const text = authMessage.textContent;
  const isError = authMessage.classList.contains("error");
  const resendHidden = resend.hidden;
  setAuthMode("login");
  showMessage(authMessage, text, isError);
  resend.hidden = resendHidden;
}

resendButton.addEventListener("click", async () => {
  const email = authForm.email.value.trim();
  if (!email) {
    showMessage(authMessage, "Type your email above first.", true);
    return;
  }
  resendButton.disabled = true;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  resendButton.disabled = false;
  showMessage(authMessage, error ? friendlyAuthError(error) : `Sent a new confirmation link to ${email}.`, Boolean(error));
});

function setPasswordVisible(visible) {
  authForm.password.type = visible ? "text" : "password";
  togglePassword.textContent = visible ? "Hide" : "Show";
  togglePassword.setAttribute("aria-pressed", String(visible));
  togglePassword.setAttribute("aria-label", visible ? "Hide password" : "Show password");
}

togglePassword.addEventListener("click", (event) => {
  event.preventDefault();
  setPasswordVisible(authForm.password.type === "password");
  authForm.password.focus();
});

loginTab.addEventListener("click", () => setAuthMode("login"));
signupTab.addEventListener("click", () => setAuthMode("signup"));
authSwitchButton.addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login"));

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  await supabase.auth.signOut();
  logoutButton.disabled = false;
});

function showSignedIn(user) {
  const changedUser = currentUser?.id !== user.id;
  currentUser = user;
  setPasswordVisible(false);
  accountEmail.textContent = user.user_metadata?.full_name || user.email;
  accountEmail.title = user.email;
  appLoading.hidden = true;
  authView.hidden = true;
  account.hidden = false;
  appView.hidden = false;
  if (changedUser) loadExpenses();
}

function showSignedOut() {
  currentUser = null;
  expenses = [];
  list.replaceChildren();
  renderSummary();
  form.reset();
  form.spent_on.value = todayISO();
  showMessage(formMessage, "");
  appLoading.hidden = true;
  appView.hidden = true;
  account.hidden = true;
  authView.hidden = false;
}

// Fires on page load (INITIAL_SESSION), login, logout and token refresh.
// Supabase calls are deferred so they don't run inside the auth callback.
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    if (session?.user) showSignedIn(session.user);
    else showSignedOut();
  }, 0);
});

// ---------- Expenses ----------

async function loadExpenses() {
  showMessage(listMessage, "Loading…");
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("spent_on", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    showMessage(listMessage, `Couldn't load expenses: ${error.message}`, true);
    return;
  }

  expenses = data;
  await loadReceiptUrls();
  showMessage(listMessage, expenses.length === 0 ? "No expenses yet. Add your first one above." : "");
  renderFilter();
  renderList();
  renderSummary();
}

// The receipts bucket is private, so each photo gets a short-lived link.
async function loadReceiptUrls() {
  const paths = expenses.map((e) => e.receipt_path).filter(Boolean);
  if (paths.length === 0) return;

  const { data, error } = await supabase.storage.from("receipts").createSignedUrls(paths, RECEIPT_LINK_SECONDS);
  if (error) return;

  const urls = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  for (const e of expenses) e.receipt_url = urls.get(e.receipt_path);
}

function renderSummary() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const sum = (rows) => rows.reduce((total, e) => total + Number(e.amount), 0);

  document.getElementById("today-total").textContent = kd(sum(expenses.filter((e) => e.spent_on === today)));
  document.getElementById("month-total").textContent = kd(sum(expenses.filter((e) => e.spent_on.startsWith(month))));

  const biggest = expenses.reduce((max, e) => (!max || Number(e.amount) > Number(max.amount) ? e : max), null);
  document.getElementById("biggest").textContent = biggest ? kd(biggest.amount) : "–";
  document.getElementById("biggest-item").textContent = biggest ? biggest.item : "";
}

function renderFilter() {
  const current = filter.value;
  const categories = [...new Set(expenses.map((e) => e.category))].sort();
  filter.replaceChildren(new Option("All categories", ""), ...categories.map((c) => new Option(c, c)));
  filter.value = categories.includes(current) ? current : "";
}

function renderList() {
  const shown = filter.value ? expenses.filter((e) => e.category === filter.value) : expenses;

  list.replaceChildren(...shown.map((e) => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = e.item;
    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = [e.category, e.spent_on, e.payment_method, e.note].filter(Boolean).join(" · ");
    left.append(name, meta);

    const main = document.createElement("div");
    main.className = "item-main";
    if (e.receipt_url) {
      const link = document.createElement("a");
      link.className = "receipt";
      link.href = e.receipt_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = "Open receipt";
      if (e.receipt_path.endsWith(".pdf")) {
        link.textContent = "PDF";
      } else {
        const img = document.createElement("img");
        img.src = e.receipt_url;
        img.alt = `Receipt for ${e.item}`;
        link.append(img);
      }
      main.append(link);
    }
    main.append(left);

    const amount = document.createElement("div");
    amount.className = "item-amount";
    amount.textContent = kd(e.amount);

    li.append(main, amount);
    return li;
  }));
}

function showMessage(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const button = form.querySelector("button");
  button.disabled = true;
  showMessage(formMessage, "Saving…");

  const values = Object.fromEntries(new FormData(form));
  const row = {
    user_id: currentUser.id,
    item: values.item.trim(),
    amount: Number(values.amount),
    category: values.category,
    spent_on: values.spent_on,
    payment_method: values.payment_method || null,
    is_need: values.is_need === "" ? null : values.is_need === "true",
    note: values.note.trim() || null,
    receipt_path: null,
  };

  // Receipts go in a folder named after the user, e.g. receipts/<user id>/<random>.png
  const file = values.receipt;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
    if (uploadError) {
      button.disabled = false;
      showMessage(formMessage, `Couldn't upload the receipt: ${uploadError.message}`, true);
      return;
    }
    row.receipt_path = path;
  }

  const { error } = await supabase.from("expenses").insert(row);
  button.disabled = false;

  if (error) {
    // Don't leave a photo behind that no expense points to.
    if (row.receipt_path) await supabase.storage.from("receipts").remove([row.receipt_path]);
    showMessage(formMessage, `Couldn't save: ${error.message}`, true);
    return;
  }

  showMessage(formMessage, `Added ${row.item} (${kd(row.amount)}).`);
  form.reset();
  form.spent_on.value = todayISO();
  loadExpenses();
});

filter.addEventListener("change", renderList);
