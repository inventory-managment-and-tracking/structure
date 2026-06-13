const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function parseDateParts(iso) {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-').map(Number);
    return { year, month, day };
  }
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

export function toIsoDate({ year, month, day }) {
  const maxDay = daysInMonth(year, month);
  const safeDay = Math.min(Math.max(day, 1), maxDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function getYearOptions(rangeBack = 6, rangeForward = 1) {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current - rangeBack; y <= current + rangeForward; y += 1) {
    years.push(y);
  }
  return years;
}

export function getMonthOptions() {
  return MONTHS;
}

export function getDayOptions(year, month) {
  const count = daysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => i + 1);
}

export function formatDatePartsLabel(iso) {
  const { year, month, day } = parseDateParts(iso);
  const monthLabel = MONTHS.find((m) => m.value === month)?.label || String(month);
  return `${day} ${monthLabel} ${year}`;
}

export function safeDateInputValue(nextValue, currentValue) {
  if (nextValue && /^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
    return nextValue;
  }
  return currentValue;
}
