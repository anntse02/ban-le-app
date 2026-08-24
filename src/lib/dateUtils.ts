/**
 * Tiện ích xử lý ngày giờ theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7)
 */

export function getVietnamDate(date = new Date()): string {
  // Định dạng chuẩn YYYY-MM-DD theo múi giờ Việt Nam
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function getVietnamTime(date = new Date()): string {
  // Định dạng chuẩn HH:mm:ss theo múi giờ Việt Nam
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

export function formatVietnamDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getVietnamTodayDisplay(): string {
  const dateStr = getVietnamDate();
  return formatVietnamDisplayDate(dateStr);
}