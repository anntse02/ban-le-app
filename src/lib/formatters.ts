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

/**
 * Định dạng chuỗi hiển thị trong ô nhập tiền tệ có dấu chấm phân cách hàng nghìn (VD: 380000 -> "380.000")
 */
export function formatCurrencyInput(val: number | string): string {
  if (val === "" || val === null || val === undefined) return "";
  const cleanStr = String(val).replace(/\D/g, "");
  if (!cleanStr) return "";
  const num = Number(cleanStr);
  return formatNumberVN(num);
}

/**
 * Chuyển chuỗi tiền tệ có dấu chấm thành số nguyên (VD: "380.000" -> 380000)
 */
export function parseCurrencyInput(val: string): number {
  if (!val) return 0;
  const cleanStr = val.replace(/\D/g, "");
  return cleanStr ? Number(cleanStr) : 0;
}

/**
 * Xử lý nhập số lượng: tự động loại bỏ số 0 ở đầu (VD: "05" -> 5, "007" -> 7, "" -> "")
 */
export function parseQuantityInput(val: string, max?: number): number | "" {
  if (val === "") return "";
  const cleanStr = val.replace(/\D/g, "");
  if (!cleanStr) return "";
  const num = Number(cleanStr); // Number("05") -> 5 tự động bỏ số 0 đầu
  if (typeof max === "number" && num > max) return max;
  return num;
}