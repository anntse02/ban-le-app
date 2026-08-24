/**
 * Tiện ích định dạng tiền và số chuẩn Việt Nam,
 * bảo đảm kết quả giống nhau 100% giữa Server (SSR) và Client (tránh lỗi React Hydration).
 */

export function formatNumberVN(num: number | string): string {
  const n = typeof num === "number" ? num : Number(num);
  if (isNaN(n)) return "0";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatCurrencyVND(num: number | string): string {
  const n = typeof num === "number" ? num : Number(num);
  if (isNaN(n) || n === 0) return "0 đ";
  return `${formatNumberVN(n)} đ`;
}