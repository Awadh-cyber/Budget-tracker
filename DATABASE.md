# Budget Tracker — Database

My Budget Tracker remembers **where my money goes**. Each time I spend money, I log it as one row.

The database lives in my Supabase project (`budget-tracker`), not on my laptop, so any device can reach it.

## The table: `expenses`

One row = one thing I spent money on.

| Column | Type | Must be filled? | Why it's there |
|---|---|---|---|
| `id` | number (fills itself in) | yes | Gives every row its own unique number, so I can point to one exact expense. |
| `created_at` | date and time (fills itself in) | yes | The moment the row was added to the database. |
| `item` | text | yes | What I bought, like "Lunch at a café". |
| `amount` | number (up to 3 decimals) | yes | How much it cost, in KD. It's a number, not text, so I can add amounts up and sort them. It must be more than 0. |
| `category` | text | yes | The group it belongs to, like Food, Transport or Bills. It has its own column so I can filter by it. |
| `spent_on` | date | yes (today by default) | The day I spent the money. If I don't give one, it uses today. |
| `payment_method` | text | no | How I paid: cash, card, K-Net… |
| `is_need` | true/false | no | `true` if I needed it, `false` if it was a want. |
| `note` | text | no | Anything extra I want to remember. |

**The details I'll filter by:** `category`, `spent_on` and `amount`.

| `receipt_path` | text | no | Where the receipt photo is saved in the `receipts` bucket, like `<user id>/<random>.png`. |
| `user_id` | user id (fills itself in) | for new rows | Which account owns this expense. Older rows have no owner yet. |

**Security:** Row Level Security is switched on. Each logged-in user can only see, add, change and delete **their own** expenses. Visitors who aren't logged in can't see anything. See "Accounts and access" below.

## My rows

Three real things I spent money on this week:

| id | item | amount (KD) | category | spent_on | payment_method | is_need | note |
|---|---|---|---|---|---|---|---|
| 1 | Lunch at a café | 3.500 | Food | 2026-11-02 | Card | false | Lunch with friends after class |
| 2 | Uber to CODED | 2.000 | Transport | 2026-11-02 | Card | true | — |
| 3 | Phone bill | 8.000 | Bills | 2026-11-01 | K-Net | true | Monthly plan |

`id` and `created_at` filled themselves in. I didn't type them.

## My two questions

### 1. How much did I spend today (2 Nov 2026)?

```sql
select sum(amount), count(*) from expenses where spent_on = '2026-11-02';
```

In simple words: pick only the rows where the day is 2 Nov, then add up their amounts and count them.

**Answer:** 5.500 KD across 2 expenses: lunch at a café (3.500) and an Uber (2.000).

### 2. What was my biggest spend?

```sql
select item, amount, category, spent_on from expenses order by amount desc limit 1;
```

In simple words: sort every row from the most expensive to the cheapest, then keep only the top one.

**Answer:** the phone bill, 8.000 KD (Bills) on 1 Nov 2026.

## The SQL in simple words

- **CREATE TABLE** made the `expenses` table and its columns.
- **INSERT** added my 3 rows.
- **SELECT** read the rows back to answer my questions. It doesn't change anything.

## Accounts and access

People log in with an **email and password**. This uses **Supabase Auth**, not a password table I made myself.

### How it matches the board

| On the board | In this project |
|---|---|
| **FE** (frontend) sends username + password | The website (`app.js`) sends the **email** + password to Supabase Auth. |
| **BE** (backend) checks the account and password | Supabase Auth checks them. Passwords are stored scrambled (hashed) in Supabase's own `auth.users` table, never in `expenses`. |
| BE issues a **JWT** after a successful login | Supabase gives the website a JWT (an "access token", like a signed ID card) and a refresh token. |
| No account? Offer **registration** | The **Create account** tab. Supabase emails a confirmation link first; after clicking it, you can log in. |
| **DB** (database) | Postgres in Supabase. Every request from the website carries the JWT, and the database reads the user id from it. |

### Who can see what (Row Level Security)

- **Expenses:** a row is visible only when its `user_id` matches the logged-in user's id.
- **Receipts:** the `receipts` bucket is private. Each user uploads into their own folder (`receipts/<user id>/…`) and can only open files in that folder. Photos are shown with signed links that stop working after 10 minutes.
- **Not logged in:** nothing at all.
- **Rows with no owner** (the first rows I added before accounts existed) are kept safe in the database, but nobody can see them on the website until I decide who owns them.

The exact rules are in [`supabase/access-rules.sql`](supabase/access-rules.sql).

### Staying logged in

The Supabase SDK saves the session in the browser and refreshes the JWT automatically before it expires, so reloading the page keeps you logged in. **Log out** clears it.

### Keys

The website only uses the **publishable** key, which is safe to be public because the rules above decide what it can do. The secret (service role) key is never in this code or in Git.
