// Today's hole number and date for the home page, kept apart from the sample
// hole so the home bundle never pulls in answer lists. M2 serves these from
// GET /api/hole/today instead. today.spec.ts keeps them in sync with the data.

export const TODAY = { holeNo: 214, date: '2026-10-25', prompts: 5 } as const;
