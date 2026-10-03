"use strict";
/**
 * WhatsApp Service - Permanently Disabled
 * All WhatsApp alerts and automated messages have been removed as requested.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLateAttendanceMessage = formatLateAttendanceMessage;
exports.dispatchWhatsApp = dispatchWhatsApp;
exports.sendLateAttendanceAlert = sendLateAttendanceAlert;
exports.checkAndSendLateAttendanceAlerts = checkAndSendLateAttendanceAlerts;
function formatLateAttendanceMessage(_employee, _dateStr) {
    return '';
}
async function dispatchWhatsApp(_toPhone, _message) {
    return { success: false, provider: 'Disabled' };
}
async function sendLateAttendanceAlert(_employee, _dateStr) {
    // Permanently disabled
    return false;
}
async function checkAndSendLateAttendanceAlerts(_overrideDateStr) {
    // Permanently disabled
    return {
        success: false,
        message: 'WhatsApp alerts have been completely disabled.',
        alertsSent: 0,
        alertedList: [],
        skippedList: []
    };
}
