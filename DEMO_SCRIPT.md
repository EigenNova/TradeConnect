# TradeConnect — pitch-day demo script (3–5 minutes)

**Setup before you walk on stage**

1. `npm run db:seed` (fresh demo data, ~10 seconds) then `npm run dev`.
2. Open three browser profiles/windows, already signed in — switching accounts live wastes time:
   * **W1 Customer** — `mary.kaupa@example.com` on `/customer/dashboard`
   * **W2 Tradesperson** — `joe.kila@example.com` on `/tradesperson/dashboard`
   * **W3 Admin** — `admin@tradeconnect.pg` on `/admin/verifications`
   * password: `Demo1234!`
3. Keep a 4th tab on the landing page `/` to start from.
4. Zoom to ~110% and narrow W1 to phone width — most Lae users are on a phone.

---

## 0:00 — The problem (20s, landing page)

> "In Lae, finding a tradesperson you can trust means asking around on Facebook and hoping.
> Tradies have the opposite problem: no way to prove they are qualified. TradeConnect is a
> marketplace of **verified** electricians, mechanics and plumbers."

Scroll the landing page once: three pilot trades, "first 3 jobs free, then 5%".

## 0:20 — Verified supply (30s, `/browse`)

Click **Browse tradies**.

* Filter **Electrical** → the list narrows.
* Point at the green **Verified** badge, the star rating and the jobs-completed count.

> "Nobody appears here with a badge until a human has checked their ID and trade certificate."

## 0:50 — Customer posts a job (50s, W1)

From `/browse`, click **Request this tradie** on **Joe Kila** (or **Post a job**).

Fill it in while talking:

* Trade: **Electrical**
* Title: `Power point sparking in the shop`
* Description: `Sparks when we plug in the fridge, shop in Eriku, need someone today`
* Location: `Eriku, Lae` · Budget: `800`

Click **Post job** → lands on the job page.

> "One minute, no phone calls. The job is now visible to verified electricians in Lae."

## 1:40 — Tradesperson quotes (40s, W2)

Switch to Joe's dashboard and refresh.

* Point at the stats strip: **Free jobs left: 0**, **Commission owed: K100** — his three free jobs
  are used up.
* The new job is in **Open leads in your trades** → expand **Send a quote**, price `750`,
  message `Can be there in an hour`, **Send quote**.

## 2:20 — Accept, chat, complete (60s, W1 → W2)

Back in W1, refresh the job page.

* The quote from Joe shows K750 → **Accept quote**.
* The job flips to **In progress**, the chat opens, Joe's phone number appears.
* Type `Thanks Joe, gate code is 1234` and send.
* Switch to W2 → the message is already there (Realtime, no refresh) → reply `On my way`.

In W2 open the job → the card says **Commission at 5%: K37.50 of K750** → **Mark job complete**.

> "The commission is calculated and recorded by the database at the moment of completion — not by
> the app, so it cannot be skipped."

## 3:20 — Review closes the loop (25s, W1)

Refresh W1 → the job is **Completed** and the review form is live.

* 5 stars, `Fast, tidy, fair price` → **Post review**.

> "Reviews are only possible on a job the customer actually completed — the database rejects
> anything else. That is what keeps the ratings honest."

## 3:45 — Admin: verification + money (45s, W3)

Open `/admin/verifications`:

* **Nathan Gabi** is waiting → open his ID (a private, signed link that expires in 5 minutes) →
  **Approve & verify**.

> "That is the whole trust model: one person, one click, and the badge is live."

Open `/admin/metrics`:

* Total users, **verified tradespeople**, **completed jobs**, **commission billed**.
* Scroll to the commission ledger: rows marked **free job** (the first three per tradie) next to
  billable 5% rows, with **Mark paid** for off-platform settlement.

## 4:30 — Close (20s)

> "Pilot scope: Lae, three trades, verification by hand. Revenue is 5% of job value, waived for a
> tradie's first three jobs so supply has zero risk to join. Payments stay off-platform for now —
> we record what is owed, and turn that into digital payments in phase two."

---

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Quote button errors | The tradie is not verified — approve them in W3 first. |
| Chat looks stale | The indicator shows *Syncing* — it polls every 8s; refresh the page. |
| Demo data looks used up | Re-run `npm run db:seed` (it rebuilds the demo accounts from scratch). |
| Signup asks to confirm email | Supabase → Authentication → Email → turn **Confirm email** off. |

## Numbers to quote from the seed

* 7 accounts · 4 tradespeople · **3 verified, 1 in the queue**
* 9+ jobs, 6 completed, **5 commission-free** + **K100 billed** before the live demo
* Take rate **5%**, waived for the first **3** completed jobs per tradesperson
