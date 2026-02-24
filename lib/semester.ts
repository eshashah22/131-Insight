/**
 * University of Maryland, College Park semester utilities
 * 
 * UMD Semesters:
 * - Fall: Late August - December
 * - Spring: Late January - May
 * - Summer: May - August
 */

export type Semester = 'Fall' | 'Spring' | 'Summer';
export type SemesterCode = `${Semester} ${number}`; // e.g., "Fall 2024"

/**
 * Determines the semester from a given date
 * @param date - The date to check
 * @returns The semester code (e.g., "Fall 2024")
 */
export function getSemesterFromDate(date: Date): SemesterCode {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  // Fall: August (8) - December (12)
  if (month >= 8 && month <= 12) {
    return `Fall ${year}`;
  }
  
  // Spring: January (1) - May (5)
  if (month >= 1 && month <= 5) {
    return `Spring ${year}`;
  }
  
  // Summer: June (6) - July (7)
  return `Summer ${year}`;
}

/**
 * Gets the current semester
 */
export function getCurrentSemester(): SemesterCode {
  return getSemesterFromDate(new Date());
}

/**
 * Gets all semesters from a list of dates
 */
export function getUniqueSemesters(dates: Date[]): SemesterCode[] {
  const semesters = dates.map(date => getSemesterFromDate(date));
  return Array.from(new Set(semesters)).sort().reverse(); // Most recent first
}

/**
 * Gets the start and end dates for a semester
 */
export function getSemesterDateRange(semester: SemesterCode): { start: Date; end: Date } {
  const [semesterName, yearStr] = semester.split(' ');
  const year = parseInt(yearStr);

  let start: Date;
  let end: Date;

  switch (semesterName) {
    case 'Fall':
      // Fall starts late August, ends mid-December
      start = new Date(year, 7, 26); // August 26
      end = new Date(year, 11, 20); // December 20
      break;
    case 'Spring':
      // Spring starts late January, ends mid-May
      start = new Date(year, 0, 29); // January 29
      end = new Date(year, 4, 15); // May 15
      break;
    case 'Summer':
      // Summer starts late May, ends mid-August
      start = new Date(year, 4, 28); // May 28
      end = new Date(year, 7, 15); // August 15
      break;
    default:
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
  }

  return { start, end };
}

