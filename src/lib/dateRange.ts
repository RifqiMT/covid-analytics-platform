const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in UTC as YYYY-MM-DD (aligned with OWID daily keys). */
export function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeDateRange(
  from: string,
  to: string,
): { dateFrom: string; dateTo: string; rangeNotes: string[] } {
  const notes: string[] = [];
  const today = utcTodayIso();
  let dateFrom = from.trim();
  let dateTo = to.trim();

  if (!ISO_DAY.test(dateFrom)) {
    dateFrom = "2020-01-01";
    notes.push("Start date was invalid; using 2020-01-01.");
  }
  if (!ISO_DAY.test(dateTo)) {
    dateTo = today;
    notes.push("End date was invalid; using today (UTC).");
  }
  if (dateTo > today) {
    notes.push(
      `End date was after today (${today} UTC); clamped because COVID reporting has no future observations.`,
    );
    dateTo = today;
  }
  if (dateFrom > dateTo) {
    notes.push(
      "Start date was after end date; start was moved to match the end date.",
    );
    dateFrom = dateTo;
  }
  return { dateFrom, dateTo, rangeNotes: notes };
}
