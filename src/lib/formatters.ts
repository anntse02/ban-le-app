/**
 * Tiện ích định dạng tiền và số chuẩn Việt Nam,
 * bảo đảm kết quả giống nhau 100% giữa Server (SSR) và Client (tránh lỗi React Hydration).
 */

export function formatNumberVN(num: number | string): string {
  const n = typeof num === "number" ? num : parseFloat(String(num).replace(/,/g, "."));
  if (isNaN(n)) return "0";
  if (Number.isInteger(n)) {
    return n
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  // Số thập phân (VD: 0.5 -> "0,5"; 10.5 -> "10,5")
  const parts = n.toString().split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decPart = parts[1] || "";
  return decPart ? `${intPart},${decPart}` : intPart;
}

export function formatCurrencyVND(num: number | string): string {
  const n = typeof num === "number" ? num : parseFloat(String(num).replace(/,/g, "."));
  if (isNaN(n) || n === 0) return "0 đ";
  return `${formatNumberVN(Math.round(n))} đ`;
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
 * Chuyển đổi số lượng từ input (number hoặc string) sang số thực float, hỗ trợ cả dấu phẩy và dấu chấm
 */
export function parseQuantityNumber(val: number | string): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const normalized = String(val).replace(/,/g, ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Xử lý nhập số lượng: hỗ trợ số nguyên và số thập phân (VD: "0,5", "2,5", "10,5", "5")
 * Tự động loại bỏ số 0 ở đầu cho số nguyên (VD: "05" -> 5) nhưng giữ nguyên "0,5"
 */
export function parseQuantityInput(val: string, max?: number): number | string {
  if (val === "" || val === null || val === undefined) return "";
  // Chuẩn hóa dấu phẩy thành dấu chấm để xử lý
  let s = String(val).replace(/,/g, ".");
  // Giữ lại số và tối đa 1 dấu chấm thập phân
  s = s.replace(/[^0-9.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) {
    s = parts[0] + "." + parts.slice(1).join("");
  }
  // Nếu người dùng vừa gõ dấu phẩy/chấm ở cuối (VD: "0," hoặc "2."), giữ nguyên để tiếp tục gõ
  if (s.endsWith(".")) {
    return val.endsWith(",") ? s.replace(".", ",") : s;
  }
  if (!s) return "";
  // Bỏ số 0 vô nghĩa ở đầu cho số nguyên (VD "05" -> 5), nhưng không bỏ nếu là "0.5"
  if (s.startsWith("0") && s.length > 1 && !s.startsWith("0.")) {
    s = s.replace(/^0+/, "") || "0";
  }
  const num = parseFloat(s);
  if (isNaN(num)) return "";
  if (typeof max === "number" && num > max) return max;
  return val.includes(",") ? s.replace(".", ",") : s;
}