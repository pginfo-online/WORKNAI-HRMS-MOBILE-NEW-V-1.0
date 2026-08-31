import { format, isValid, parseISO } from 'date-fns';

/**
 * Safely format a date string or Date object using date-fns format.
 * Prevents RangeError exceptions when handling invalid, null, or undefined dates.
 */
export function safeFormat(
  dateValue: string | Date | null | undefined,
  formatPattern: string,
  fallback: string = '--'
): string {
  if (!dateValue) return fallback;

  try {
    let dateObj: Date;
    if (typeof dateValue === 'string') {
      dateObj = parseISO(dateValue);
      if (!isValid(dateObj)) {
        dateObj = new Date(dateValue);
      }
    } else {
      dateObj = dateValue;
    }

    if (!isValid(dateObj) || isNaN(dateObj.getTime())) {
      return fallback;
    }

    return format(dateObj, formatPattern);
  } catch (err) {
    console.warn('[dateUtils] safeFormat failed for value:', dateValue, err);
    return fallback;
  }
}
