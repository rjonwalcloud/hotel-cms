/**
 * Centralized Date Utilities
 */

/**
 * Formats a Date object or date string to YYYY-MM-DD in LOCAL timezone.
 * Avoids the date-shift bug caused by .toISOString().split('T')[0]
 * which converts to UTC first.
 * 
 * @param {Date|string} dateInput 
 * @returns {string} YYYY-MM-DD
 */
function formatDate(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

module.exports = {
    formatDate
};
