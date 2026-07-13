# Sprint 3 Commute Validation Demo Scenarios

## Purpose

This document gives the Sprint 3 reviewer a repeatable way to confirm that commute time changes the housing recommendation flow. It is written for a professor or reviewer who wants to see that the commute field is not just displayed text.

The scenarios show commute affecting:

- search results and result ordering
- max commute filtering
- Value Score ranking
- recommendation summaries and badges
- side-by-side comparison

## Why Commute Matters

Toronto students often balance monthly rent with TTC commute time. A cheaper listing is not always the better student choice if it adds a long ride each morning. A higher-rent listing can be more realistic when it saves significant travel time, especially for students with labs, placements, work shifts, or late classes.

The app should make that tradeoff visible. Students should be able to see when a short commute improves a listing and when a lower rent may still justify a longer commute.

Transparency note: The current Sprint 3 demo uses seeded sample listing data and estimated commute values. This allows the team to validate the decision-support logic before connecting real listing or commute APIs in a future version.

## Demo Setup / Pre-Demo Checklist

Use the deployed app for Sprint Review when it is available. Keep the local app ready as a fallback.

1. Open the deployed app or local app.
2. Log in with a demo account.
3. Select the campus used by the scenario.
4. Save or search preferences.
5. Open the results page.
6. Confirm result cards show estimated commute and Value Score.
7. Confirm the Refine Results panel is visible.
8. Confirm Value Score priority sliders are visible.
9. Confirm the Compare feature is available from result cards and the compare toolbar.
10. Confirm seeded listings are available in the current environment.

Backend fallback commands:

```bash
cd backend
npm install
npm run check
npm run dev
```

Frontend fallback commands:

```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

Local demo note: the backend requires a valid MongoDB connection string in `backend/.env`. Do not commit real `.env` files.

## Scenario 1 - Shortest Commute Priority

Persona: Maya is a first-year student at Toronto Metropolitan University.

Goal: Maya wants the shortest possible commute because she has morning labs and does not want long TTC rides before class.

Demo steps:

1. Log in with the demo account.
2. Select `Toronto Metropolitan University` as the campus.
3. Use a moderate rent range, such as `$500` to `$2,500`.
4. Open the results page.
5. Show the original result order and point out that rent, safety, amenities, and commute all contribute to Value Score.
6. Increase the `Commute` Value Score priority if the slider is available, for example to about `60%`.
7. Apply a max commute filter around `20` minutes.
8. Observe that listings with short Toronto Metropolitan University commutes become the visible priority.
9. Open the top listing details and point out the commute and score breakdown.

Seeded examples to use:

| Listing | Rent | Toronto Metropolitan University commute |
| --- | ---: | ---: |
| Downtown Furnished Studio | $2,200 | 10 min |
| Downtown Room Near Jarvis | $1,180 | 11 min |
| Chinatown Walk-Up Apartment | $2,050 | 16 min |
| Kensington Market Studio Loft | $1,680 | 20 min |
| Furnished Annex Room Near Bloor | $980 | 24 min |
| Scarborough Shared Townhouse Room | $780 | 58 min |

Expected result changes:

- With commute priority raised, the 10-20 minute listings should move higher because their commute score is strong.
- With a `20` minute max commute filter, the visible exact-campus commute examples should narrow to Downtown Furnished Studio, Downtown Room Near Jarvis, Chinatown Walk-Up Apartment, and Kensington Market Studio Loft.
- Listings with longer Toronto Metropolitan University commutes, such as Scarborough Shared Townhouse Room at 58 minutes, should be removed by the max commute filter.
- This proves commute is part of the recommendation logic, not only a label on the card.

Expected talking point:

"Even if two listings are similar, the app makes commute visible and can prioritize the listing that saves the student time."

## Scenario 2 - Lower Rent vs Longer Commute Tradeoff

Persona: Arjun is a budget-conscious student at Seneca Polytechnic.

Goal: Arjun is willing to accept a longer commute if the rent is much cheaper.

Demo steps:

1. Select `Seneca Polytechnic -- Newnham` as the campus.
2. Use a broad rent range, such as `$500` to `$2,500`, so both budget and higher-rent options appear.
3. Open the results page.
4. Set max commute to about `65` minutes so the seeded Seneca commute examples remain visible.
5. Show that some shorter-commute options have higher rent.
6. Increase the `Affordability` Value Score priority if the slider is available, for example to about `65%`, and reduce the commute priority if needed.
7. Compare the visible results where lower-rent listings have longer commute times.
8. Tighten max commute to about `40` minutes as a contrast and show that some budget listings disappear when commute is no longer acceptable.

Seeded examples to use:

| Listing | Rent | Seneca Polytechnic commute |
| --- | ---: | ---: |
| Scarborough Shared Townhouse Room | $780 | 45 min |
| York Village Shared House | $875 | 50 min |
| Affordable Scarborough Basement | $1,025 | 52 min |
| Yonge and Eglinton Shared Apartment Room | $1,325 | 46 min |
| North York Unfurnished Studio | $1,850 | 34 min |
| North York Two-Bed Near Finch | $2,450 | 32 min |
| Kensington Market Studio Loft | $1,680 | 62 min |

Expected result changes:

- Cheaper listings should become more competitive when affordability is prioritized.
- Scarborough Shared Townhouse Room and York Village Shared House should be attractive budget options even though their commute times are longer than the North York listings.
- Longer commute remains visible, so the student understands the tradeoff instead of receiving a blind recommendation.
- If the max commute filter is tightened to around `40` minutes, longer-commute budget listings such as Scarborough Shared Townhouse Room, York Village Shared House, and Affordable Scarborough Basement should be removed.
- This shows rent and commute work together rather than independently.

Expected talking point:

"This scenario shows that the app does not blindly choose the shortest commute. It helps students see when a cheaper listing may still be worth considering."

## Scenario 3 - Side-by-Side Commute Comparison

Persona: Sophia is an upper-year student choosing between two serious housing options.

Goal: Sophia wants to compare two listings with different commute times before deciding.

Demo steps:

1. Search for `Toronto Metropolitan University`.
2. Add two or three listings to Compare from the result cards.
3. Open the Compare view.
4. Point out monthly rent, TTC commute, safety, amenities, Value Score, and score breakdown.
5. Show two listings with noticeably different commute times.
6. Explain which listing is stronger for commute and which listing may be stronger for budget.

Seeded comparison pair:

| Listing | Rent | Toronto Metropolitan University commute | Demo point |
| --- | ---: | ---: | --- |
| Downtown Furnished Studio | $2,200 | 10 min | Strongest commute option |
| Scarborough Shared Townhouse Room | $780 | 58 min | Much cheaper, but a long commute |
| Kensington Market Studio Loft | $1,680 | 20 min | Optional balanced third comparison |

Expected result changes:

- Compare view should show the commute difference directly in the `TTC Commute` row.
- The shortest commute should be visually marked as the strongest commute option when at least two listings are compared.
- The lowest rent should be visible separately from the commute result.
- The Value Score and score breakdown should help explain why the overall recommendation may differ from the cheapest listing.
- The reviewer can see that commute affects decision-making without needing to remember values from separate cards.

Expected talking point:

"The comparison view makes commute differences obvious instead of forcing the user to remember details from separate listing cards."

## Screenshot Checklist

Prepare screenshots or written notes before Sprint Review. Screenshots do not need to be committed unless the repo already stores demo screenshots.

- [ ] Search form with selected campus.
- [ ] Results page before applying commute-focused changes.
- [ ] Results page after applying commute filter or commute weight.
- [ ] Listing card showing commute and Value Score.
- [ ] Recommendation summary or badges, especially `Shortest Commute` when visible.
- [ ] Compare view with two listings and different commute times.
- [ ] Empty state if max commute or advanced filters remove all results.
- [ ] Details page showing commute explanation and score breakdown.

## Team Presentation Assignments

| Team Member | Demo Responsibility |
| --- | --- |
| Ved Patel | Introduce commute validation purpose and explain why commute matters |
| Darsh Parmar | Present Scenario 1: shortest commute priority |
| Nakul Ariwala | Present Scenario 2: lower rent vs longer commute tradeoff |
| Aung Moe Thwe | Present Scenario 3: side-by-side commute comparison |
| Te-Chia Lin | Support Q&A, screenshots, and fallback demo flow |

Update this table before Sprint Review if the team changes responsibilities.

## Expected Reviewer Talking Points

- Commute is included in listing data as estimated minutes per campus.
- Commute appears in the UI so students can inspect it.
- Commute affects Value Score and ranking through scoring logic.
- Max commute filtering can remove unsuitable listings.
- Value Score priority sliders let the user prioritize commute or affordability more strongly.
- Recommendation badges and summaries make commute-related strengths easier to explain.
- Compare view makes commute tradeoffs visible side by side.
- The data is seeded for Sprint 3 validation and can be replaced by real APIs later.

## Validation Checklist

- [ ] Scenario 1 completed without manual explanation gaps.
- [ ] Scenario 1 confirmed ranking or filtering changes when commute is prioritized.
- [ ] Scenario 2 completed and the rent/commute tradeoff was clear.
- [ ] Scenario 2 confirmed cheaper listings can rank higher when affordability is prioritized.
- [ ] Scenario 3 completed and commute difference was visible in Compare view.
- [ ] Scenario flow can be presented without needing professor prompts.
- [ ] Deployed version works.
- [ ] Local version works as fallback.
- [ ] Screenshots or notes are prepared.
- [ ] Team member assignments are confirmed.
- [ ] Reviewer can understand why commute matters.
