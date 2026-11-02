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

**Security:** Row Level Security is switched on. For now that means only I can see the data, through the Supabase dashboard and Claude. Nobody can read it from a website yet.
