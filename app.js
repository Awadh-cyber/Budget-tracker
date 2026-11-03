import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// The publishable key is safe to put in a website. What it can do is
// controlled by the Row Level Security rules on the expenses table.
const SUPABASE_URL = "https://eqyiciekemnazoikuwyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_xQ0bTHefdQO6XipEOfWslw_3RZZnWyR";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const form = document.getElementById("expense-form");
const formMessage = document.getElementById("form-message");
const list = document.getElementById("expense-list");
const listMessage = document.getElementById("list-message");
const filter = document.getElementById("category-filter");

let expenses = [];

const kd = (n) => `${Number(n).toFixed(3)} KD`;
const todayISO = () => new Date().toLocaleDateString("en-CA");

form.spent_on.value = todayISO();

async function loadExpenses() {
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
  if (expenses.length === 0) {
    showMessage(listMessage, "No expenses yet. If you know there are rows in Supabase, the table may not allow the website to read it yet.", true);
  } else {
    showMessage(listMessage, "");
  }
  renderFilter();
  renderList();
  renderSummary();
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

    const amount = document.createElement("div");
    amount.className = "item-amount";
    amount.textContent = kd(e.amount);

    li.append(left, amount);
    return li;
  }));
}

function showMessage(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  showMessage(formMessage, "Saving…");

  const values = Object.fromEntries(new FormData(form));
  const row = {
    item: values.item.trim(),
    amount: Number(values.amount),
    category: values.category,
    spent_on: values.spent_on,
    payment_method: values.payment_method || null,
    is_need: values.is_need === "" ? null : values.is_need === "true",
    note: values.note.trim() || null,
  };

  const { error } = await supabase.from("expenses").insert(row);
  button.disabled = false;

  if (error) {
    showMessage(formMessage, `Couldn't save: ${error.message}`, true);
    return;
  }

  showMessage(formMessage, `Added ${row.item} (${kd(row.amount)}).`);
  form.reset();
  form.spent_on.value = todayISO();
  loadExpenses();
});

filter.addEventListener("change", renderList);

loadExpenses();
