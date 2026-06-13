import React from 'react';
import {
  parseDateParts,
  toIsoDate,
  getYearOptions,
  getMonthOptions,
  getDayOptions,
  formatDatePartsLabel,
} from '../utils/datePickerUtils';

export default function DatePickerFields({
  value,
  onChange,
  label,
  idPrefix = 'date',
  className = '',
}) {
  const parts = parseDateParts(value);
  const years = getYearOptions();
  const months = getMonthOptions();
  const days = getDayOptions(parts.year, parts.month);

  const update = (patch) => {
    onChange(toIsoDate({ ...parts, ...patch }));
  };

  return (
    <div className={`date-picker-fields notranslate${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="form-label date-picker-label" htmlFor={`${idPrefix}-day`}>
          {label}
        </label>
      )}
      <div className="date-picker-value" aria-live="polite">
        {formatDatePartsLabel(value)}
      </div>
      <div className="date-picker-row">
        <div className="date-picker-part">
          <span className="date-picker-part-label">Day</span>
          <select
            id={`${idPrefix}-day`}
            value={String(parts.day)}
            onChange={(e) => update({ day: parseInt(e.target.value, 10) })}
            aria-label={`${label || 'Date'} day`}
          >
            {days.map((day) => (
              <option key={day} value={String(day)}>{day}</option>
            ))}
          </select>
        </div>

        <div className="date-picker-part">
          <span className="date-picker-part-label">Month</span>
          <select
            id={`${idPrefix}-month`}
            value={String(parts.month)}
            onChange={(e) => update({ month: parseInt(e.target.value, 10) })}
            aria-label={`${label || 'Date'} month`}
          >
            {months.map((month) => (
              <option key={month.value} value={String(month.value)}>{month.label}</option>
            ))}
          </select>
        </div>

        <div className="date-picker-part">
          <span className="date-picker-part-label">Year</span>
          <select
            id={`${idPrefix}-year`}
            value={String(parts.year)}
            onChange={(e) => update({ year: parseInt(e.target.value, 10) })}
            aria-label={`${label || 'Date'} year`}
          >
            {years.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
