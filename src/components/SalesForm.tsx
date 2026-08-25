"use client";

import React, { useState, useEffect } from "react";
import { SaleRecord, BagType, ProductItem, PaymentStatus, PickupEvent } from "@/types";
import { getVietnamDate, getVietnamTime, getVietnamTodayDisplay } from "@/lib/dateUtils";
import {
  formatCurrencyVND,
  formatNumberVN,
  formatCurrencyInput,
  parseCurrencyInput,
  parseQuantityInput,
} from "@/lib/formatters";
import CustomerModal from "@/components/CustomerModal";
import { db, isFirebaseConfigured, sanitizeForFirestore } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import {
  PlusCircle,
  CheckCircle2,
  Settings,
  Trash2,
  Plus,
  X,
  Users,
  Layers,
  Package,
  AlertTriangle,
} from "lucide-react";

interface SalesFormProps {
  onAddRecord: (record: Omit<SaleRecord, "id" | "createdAt">) => Promise<void>;
  loading?: boolean;
}

const INITIAL_PRODUCTS: ProductItem[] = [
  { id: "p1", name: "Cám lợn (heo)", price: 380000, allow25kg: true, allow50kg: true },
  { id: "p2", name: "Cám gà / vịt", price: 350000, allow25kg: true, allow50kg: true },
  { id: "p3", name: "Cám bò / dê", price: 290000, allow25kg: true, allow50kg: true },
  { id: "p4", name: "Gạo ST25", price: 420000, allow25kg: true, allow50kg: true },
  { id: "p5", name: "Gạo Đài Thơm", price: 360000, allow25kg: true, allow50kg: true },
  { id: "p6", name: "Gạo Bắc Hương", price: 340000, allow25kg: true, allow50kg: true },
  { id: "p7", name: "Phân bón NPK", price: 450000, allow25kg: true, allow50kg: true },
  { id: "p8", name: "Đạm Ure", price: 390000, allow25kg: true, allow50kg: true },
  { id: "p9", name: "Phân Lân / Kali", price: 310000, allow25kg: true, allow50kg: true },
  { id: "p10", name: "Ngô hạt / Bột ngô", price: 280000, allow25kg: true, allow50kg: true },
  { id: "p11", name: "Đường cát trắng", price: 520000, allow25kg: true, allow50kg: true },
];

/**
 * Hàm tính giá theo loại bao:
 * - Giá gốc trong danh mục là giá của bao 50kg.
 * - Nếu chọn bao 25kg: Giá chia 2. Nếu lẻ 5.000đ thì tự động cộng thêm 5.000đ để chẵn 10.000đ.
 */
export const calculateBagPrice = (basePrice50kg: number, targetBagType: string): number => {
  if (targetBagType === "25kg") {
    const half = basePrice50kg / 2;
    return Math.ceil(half / 10000) * 10000;
  }
  return basePrice50kg;
};

export default function SalesForm({ onAddRecord, loading = false }: SalesFormProps) {
  const [seller, setSeller] = useState<string>("Hằng");

  // Khách hàng (3 ô: Khách lẻ mặc định | Bảng khách quen ở giữa | Nhập tên ở cuối)
  const [isRetail, setIsRetail] = useState<boolean>(true);
  const [selectedFrequentCustomer, setSelectedFrequentCustomer] = useState<string>("");
  const [customCustomerInput, setCustomCustomerInput] = useState<string>("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);

  // Mặt hàng
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [isProductManagerOpen, setIsProductManagerOpen] = useState<boolean>(false);
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);
  const [selectedItemName, setSelectedItemName] = useState<string>(INITIAL_PRODUCTS[0].name);

  // Chi tiết đơn
  const [bagType, setBagType] = useState<BagType>("50kg");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [unitPrice, setUnitPrice] = useState<number | "">(INITIAL_PRODUCTS[0].price);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [note, setNote] = useState<string>("");

  // Khách lấy hàng nhiều lần (Gửi kho)
  const [isPartialPickup, setIsPartialPickup] = useState<boolean>(false);
  const [firstPickupQty, setFirstPickupQty] = useState<number>(1);

  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Tìm mặt hàng hiện tại đang chọn
  const currentProduct = products.find((p) => p.name === selectedItemName) || products[0];
  const isAllow25kg = currentProduct?.allow25kg !== false;
  const isAllow50kg = currentProduct?.allow50kg !== false;

  // LẮNG NGHE ĐỒNG BỘ DANH MỤC HÀNG & GIÁ QUA FIREBASE REALTIME
  useEffect(() => {
    let unsubscribe = () => {};

    if (isFirebaseConfigured() && db) {
      try {
        const prodDocRef = doc(db, "settings", "products");
        unsubscribe = onSnapshot(
          prodDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (Array.isArray(data?.list) && data.list.length > 0) {
                setProducts(data.list);
                // Cập nhật giá theo mặt hàng & loại bao hiện tại
                setSelectedItemName((prev) => {
                  const match = data.list.find((p: ProductItem) => p.name === prev);
                  const selectedProd = match || data.list[0];

                  let validBag: BagType = bagType;
                  if (selectedProd.allow25kg === false && validBag === "25kg") {
                    validBag = "50kg";
                    setBagType("50kg");
                  } else if (selectedProd.allow50kg === false && validBag === "50kg") {
                    validBag = "25kg";
                    setBagType("25kg");
                  }

                  setUnitPrice(calculateBagPrice(selectedProd.price, validBag));
                  return selectedProd.name;
                });

                try {
                  localStorage.setItem("ban_le_products", JSON.stringify(data.list));
                } catch (e) {}
                return;
              }
            }
            loadFromLocalStorage();
          },
          (err) => {
            console.warn("Lỗi Firestore products, fallback local storage:", err);
            loadFromLocalStorage();
          }
        );
      } catch (e) {
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }

    return () => unsubscribe();
  }, []);

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem("ban_le_products");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          const first = parsed[0];
          setSelectedItemName(first.name);
          const initialBag: BagType = first.allow50kg !== false ? "50kg" : "25kg";
          setBagType(initialBag);
          setUnitPrice(calculateBagPrice(first.price, initialBag));
          return;
        }
      }
    } catch (e) {
      console.error("Lỗi đọc danh sách hàng:", e);
    }
  };

  const saveProducts = async (newProducts: ProductItem[]) => {
    setProducts(newProducts);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(newProducts));
    } catch (e) {
      console.error("Lỗi lưu danh sách hàng local:", e);
    }

    // ĐỒNG BỘ LÊN FIREBASE
    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, "settings", "products"), sanitizeForFirestore({
          list: newProducts,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi lưu danh sách hàng lên Firebase:", err);
      }
    }
  };

  const handleUpdateProduct = (
    id: string,
    field: "name" | "price" | "allow25kg" | "allow50kg",
    value: any
  ) => {
    const updated = products.map((p) => {
      if (p.id === id) {
        if (field === "allow25kg" && !value && p.allow50kg === false) {
          alert("Mỗi mặt hàng phải có ít nhất 1 loại bao (25kg hoặc 50kg)!");
          return p;
        }
        if (field === "allow50kg" && !value && p.allow25kg === false) {
          alert("Mỗi mặt hàng phải có ít nhất 1 loại bao (25kg hoặc 50kg)!");
          return p;
        }

        return {
          ...p,
          [field]: field === "price" ? Math.max(0, Number(value) || 0) : value,
        };
      }
      return p;
    });

    saveProducts(updated);

    const current = updated.find((p) => p.name === selectedItemName);
    if (current) {
      let targetBag = bagType;
      if (current.allow25kg === false && targetBag === "25kg") {
        targetBag = "50kg";
        setBagType("50kg");
      } else if (current.allow50kg === false && targetBag === "50kg") {
        targetBag = "25kg";
        setBagType("25kg");
      }
      setUnitPrice(calculateBagPrice(current.price, targetBag));
    }
  };

  const handleAddNewProduct = () => {
    const newItem: ProductItem = {
      id: "p_" + Date.now(),
      name: "Hàng mới " + (products.length + 1),
      price: 300000,
      allow25kg: true,
      allow50kg: true,
    };
    const updated = [...products, newItem];
    saveProducts(updated);
    setSelectedItemName(newItem.name);
    setBagType("50kg");
    setUnitPrice(calculateBagPrice(newItem.price, "50kg"));
  };

  const handleDeleteProduct = (id: string) => {
    if (products.length <= 1) {
      alert("Cần giữ ít nhất 1 mặt hàng trong danh sách!");
      return;
    }
    const updated = products.filter((p) => p.id !== id);
    saveProducts(updated);
    if (updated.length > 0) {
      const first = updated[0];
      setSelectedItemName(first.name);
      const initialBag: BagType = first.allow50kg !== false ? "50kg" : "25kg";
      setBagType(initialBag);
      setUnitPrice(calculateBagPrice(first.price, initialBag));
    }
  };

  const handleSelectProduct = (name: string) => {
    setSelectedItemName(name);
    const found = products.find((p) => p.name === name);
    if (found) {
      let targetBag = bagType;
      if (found.allow25kg === false && targetBag === "25kg") {
        targetBag = "50kg";
        setBagType("50kg");
      } else if (found.allow50kg === false && targetBag === "50kg") {
        targetBag = "25kg";
        setBagType("25kg");
      }
      setUnitPrice(calculateBagPrice(found.price, targetBag));
    }
  };

  // Chọn loại bao ở ngoài form: tự động tính lại đơn giá
  const handleSelectBagType = (type: BagType) => {
    if (type === "25kg" && !isAllow25kg) return;
    if (type === "50kg" && !isAllow50kg) return;

    setBagType(type);
    if (currentProduct) {
      setUnitPrice(calculateBagPrice(currentProduct.price, type));
    }
  };

  const numQty = typeof quantity === "number" ? quantity : 0;
  const numPrice = typeof unitPrice === "number" ? unitPrice : 0;
  const totalPrice = numQty * numPrice;

  // Xác định tên khách cuối cùng
  const finalCustomerName = isRetail
    ? "Khách lẻ"
    : customCustomerInput.trim()
    ? customCustomerInput.trim()
    : selectedFrequentCustomer
    ? selectedFrequentCustomer
    : "Khách lẻ";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemName.trim()) {
      alert("Vui lòng chọn tên hàng hóa!");
      return;
    }
    if (numQty <= 0) {
      alert("Số lượng bao phải lớn hơn 0!");
      return;
    }
    if (numPrice <= 0) {
      alert("Vui lòng nhập đơn giá hợp lệ!");
      return;
    }

    const autoDate = getVietnamDate();
    const autoTime = getVietnamTime();

    // Xử lý đơn lấy nhiều lần
    let partialData: Partial<SaleRecord> = {};
    if (isPartialPickup) {
      const initialPicked = Math.min(numQty, Math.max(0, firstPickupQty));
      const isDone = initialPicked >= numQty;
      const historyItem: PickupEvent = {
        id: "pick_" + Date.now(),
        date: autoDate,
        time: autoTime,
        quantity: initialPicked,
        note: "Lấy lần đầu khi tạo đơn",
        createdAt: Date.now(),
      };

      partialData = {
        isPartialPickup: true,
        pickupStatus: isDone ? "completed" : "pending",
        pickedQuantity: initialPicked,
        pickupHistory: initialPicked > 0 ? [historyItem] : [],
        ...(isDone ? { completedAt: Date.now() } : {}),
      };
    } else {
      partialData = {
        isPartialPickup: false,
      };
    }

    await onAddRecord({
      date: autoDate,
      time: autoTime,
      seller,
      customerName: finalCustomerName,
      itemName: selectedItemName.trim(),
      bagType,
      quantity: numQty,
      unitPrice: numPrice,
      totalPrice,
      paymentStatus,
      paymentMethod: "cash",
      note: note.trim(),
      ...partialData,
    });

    // Reset Form về mặc định
    setQuantity(1);
    setIsRetail(true);
    setSelectedFrequentCustomer("");
    setCustomCustomerInput("");
    setPaymentStatus("paid");
    setNote("");
    setIsPartialPickup(false);
    setFirstPickupQty(1);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-3 sm:p-4 relative overflow-hidden text-slate-800 w-full max-w-full">
      {/* Toast thông báo lưu thành công */}
      {showSuccessToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 z-20 animate-bounce pointer-events-none">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã lưu đơn thành công vào sổ!</span>
        </div>
      )}

      {/* Header Form Gọn Nhẹ */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <PlusCircle className="w-4 h-4 text-green-600" />
          <h2 className="text-xs sm:text-sm font-black text-slate-800">Tạo Đơn Bán Mới</h2>
        </div>
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
          Ngày: <strong className="text-green-700 font-bold">{getVietnamTodayDisplay()}</strong>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
        {/* 1. NGƯỜI BÁN (HẰNG / GẤM) */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            {/* Nút Hằng */}
            <button
              type="button"
              onClick={() => setSeller("Hằng")}
              className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] min-w-0 ${
                seller === "Hằng"
                  ? "bg-pink-50 border-pink-500 ring-1 ring-pink-400/30 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 opacity-75"
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${
                  seller === "Hằng"
                    ? "bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-2xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                👩
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-black text-xs sm:text-sm truncate ${seller === "Hằng" ? "text-pink-900" : "text-slate-700"}`}>
                    Hằng
                  </span>
                  {seller === "Hằng" && <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Bán hàng</span>
              </div>
            </button>

            {/* Nút Gấm */}
            <button
              type="button"
              onClick={() => setSeller("Gấm")}
              className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] min-w-0 ${
                seller === "Gấm"
                  ? "bg-purple-50 border-purple-500 ring-1 ring-purple-400/30 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 opacity-75"
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${
                  seller === "Gấm"
                    ? "bg-gradient-to-tr from-purple-500 to-indigo-400 text-white shadow-2xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                👱‍♀️
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-black text-xs sm:text-sm truncate ${seller === "Gấm" ? "text-purple-900" : "text-slate-700"}`}>
                    Gấm
                  </span>
                  {seller === "Gấm" && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Bán hàng</span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. TÊN KHÁCH HÀNG: TÁCH LÀM 3 Ô */}
        <div>
          <div className="grid grid-cols-3 gap-1.5">
            {/* Ô 1: Khách Lẻ (Mặc định đơn mới chọn Khách Lẻ) */}
            <button
              type="button"
              onClick={() => {
                setIsRetail(true);
                setSelectedFrequentCustomer("");
                setCustomCustomerInput("");
              }}
              className={`h-10 px-1.5 sm:px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 active:scale-95 min-w-0 ${
                isRetail
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-1 ring-emerald-500/30"
                  : "bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              <span className="truncate">Khách lẻ</span>
              {isRetail && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />}
            </button>

            {/* Ô 2: Bảng chọn tên Khách Quen ở giữa */}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className={`h-10 px-1.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-between gap-0.5 active:scale-95 min-w-0 ${
                !isRetail && selectedFrequentCustomer
                  ? "bg-emerald-50 text-emerald-800 border-emerald-500 ring-1 ring-emerald-400/30 font-black"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Users className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span className="truncate">
                  {selectedFrequentCustomer ? selectedFrequentCustomer : "Khách quen ▾"}
                </span>
              </div>
              {selectedFrequentCustomer ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFrequentCustomer("");
                    setIsRetail(true);
                  }}
                  className="text-slate-400 hover:text-red-500 p-0.5 shrink-0"
                  title="Bỏ chọn"
                >
                  <X className="w-3 h-3" />
                </span>
              ) : null}
            </button>

            {/* Ô 3: Nhập tên khách tự do ở cuối */}
            <input
              type="text"
              placeholder="Hoặc nhập..."
              value={customCustomerInput}
              onChange={(e) => {
                const val = e.target.value;
                setCustomCustomerInput(val);
                if (val.trim().length > 0) {
                  setIsRetail(false);
                  setSelectedFrequentCustomer("");
                } else {
                  setIsRetail(true);
                }
              }}
              className={`h-10 px-2 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition min-w-0 ${
                !isRetail && customCustomerInput.trim()
                  ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500 font-bold"
                  : "border-slate-300"
              }`}
            />
          </div>
        </div>

        {/* 3. TÊN HÀNG HÓA & NÚT SỬA GIÁ (1 HÀNG) */}
        <div>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedItemName}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="flex-1 min-w-0 h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition"
            >
              {products.map((prod) => (
                <option key={prod.id} value={prod.name}>
                  {prod.name} — {formatNumberVN(prod.price)} đ
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsProductManagerOpen(true)}
              className="h-10 px-2.5 rounded-xl text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 transition shrink-0 active:scale-95"
              title="Chỉnh sửa danh mục mặt hàng, loại bao & giá"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Sửa giá</span>
            </button>
          </div>
        </div>

        {/* 4. LOẠI BAO TRỌNG LƯỢNG */}
        <div className="grid grid-cols-2 gap-2">
          {/* Nút Bao 25kg */}
          <button
            type="button"
            disabled={!isAllow25kg}
            onClick={() => handleSelectBagType("25kg")}
            className={`py-2.5 px-2 rounded-2xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all min-w-0 ${
              !isAllow25kg
                ? "bg-slate-100/70 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed"
                : bagType === "25kg"
                ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-400/30 shadow-2xs active:scale-[0.98]"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-[0.98]"
            }`}
          >
            <span>📦</span>
            <span className="truncate">Bao 25 kg</span>
            {isAllow25kg && bagType === "25kg" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
          </button>

          {/* Nút Bao 50kg */}
          <button
            type="button"
            disabled={!isAllow50kg}
            onClick={() => handleSelectBagType("50kg")}
            className={`py-2.5 px-2 rounded-2xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all min-w-0 ${
              !isAllow50kg
                ? "bg-slate-100/70 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed"
                : bagType === "50kg"
                ? "bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-400/30 shadow-2xs active:scale-[0.98]"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-[0.98]"
            }`}
          >
            <span>📦</span>
            <span className="truncate">Bao 50 kg</span>
            {isAllow50kg && bagType === "50kg" && (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            )}
          </button>
        </div>

        {/* 5. SỐ LƯỢNG & ĐƠN GIÁ (GRID 2 CỘT) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Cụm nút Số Lượng (Tự động xóa số 0 đầu: VD 05 -> 5) */}
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 block mb-0.5">Số lượng (Bao):</span>
            <div className="flex items-stretch h-11 rounded-2xl overflow-hidden border border-slate-300 min-w-0">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                className="w-10 sm:w-11 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xl flex items-center justify-center select-none transition active:scale-95 border-r border-slate-300 shrink-0"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={quantity === "" ? "" : quantity}
                onChange={(e) => setQuantity(parseQuantityInput(e.target.value))}
                className="w-full min-w-0 bg-slate-50 text-base font-black text-center text-slate-900 focus:bg-white focus:outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => (Number(prev) || 0) + 1)}
                className="w-10 sm:w-11 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xl flex items-center justify-center select-none transition active:scale-95 border-l border-slate-300 shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* Ô Đơn Giá (Có dấu chấm ngăn cách hàng nghìn/triệu) */}
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 block mb-0.5">Đơn giá / Bao (VNĐ):</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="380.000"
              value={formatCurrencyInput(unitPrice)}
              onChange={(e) => setUnitPrice(parseCurrencyInput(e.target.value))}
              className="w-full min-w-0 h-11 px-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm sm:text-base font-black text-slate-900 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition"
              required
            />
          </div>
        </div>

        {/* 6. TÙY CHỌN: KHÁCH MUA 1 ĐƠN LẤY HÀNG NHIỀU LẦN (GỬI KHO) */}
        <div className="bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-200 space-y-1.5 min-w-0">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">Khách lấy nhiều lần (Gửi kho)</span>
            </div>
            <input
              type="checkbox"
              checked={isPartialPickup}
              onChange={(e) => {
                setIsPartialPickup(e.target.checked);
                if (e.target.checked) {
                  setFirstPickupQty(1);
                }
              }}
              className="w-4.5 h-4.5 rounded text-green-600 focus:ring-green-500 shrink-0"
            />
          </label>

          {/* Nếu bật: Nhập số bao lấy lần đầu (Tự động xóa số 0 đầu: 05 -> 5) */}
          {isPartialPickup && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs animate-fadeIn">
              <span className="text-slate-600 font-semibold truncate">Lần này lấy trước:</span>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  value={firstPickupQty === 0 ? "" : firstPickupQty}
                  onChange={(e) => {
                    const q = parseQuantityInput(e.target.value, numQty);
                    setFirstPickupQty(typeof q === "number" ? q : 0);
                  }}
                  className="w-14 sm:w-16 h-8 px-2 text-center text-xs font-black bg-white border border-slate-300 rounded-xl outline-none focus:border-green-500"
                />
                <span className="text-slate-500 font-bold">/ {numQty} bao</span>
              </div>
            </div>
          )}
        </div>

        {/* 7. TRẠNG THÁI THU TIỀN: 2 NÚT NẰM TRÊN CÙNG 1 HÀNG */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            {/* Nút ĐÃ THU */}
            <button
              type="button"
              onClick={() => setPaymentStatus("paid")}
              className={`h-10 sm:h-11 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all active:scale-[0.98] min-w-0 ${
                paymentStatus === "paid"
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span>✓</span>
              <span className="truncate">Đã thu</span>
              {paymentStatus === "paid" && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
            </button>

            {/* Nút CHƯA THU */}
            <button
              type="button"
              onClick={() => setPaymentStatus("unpaid")}
              className={`h-10 sm:h-11 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 transition-all active:scale-[0.98] min-w-0 ${
                paymentStatus === "unpaid"
                  ? "bg-red-600 border-red-600 text-white shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span>✗</span>
              <span className="truncate">Chưa thu</span>
              {paymentStatus === "unpaid" && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
            </button>
          </div>
        </div>

        {/* 8. KHUNG THÀNH TIỀN TẠM TÍNH */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 py-2 px-3.5 rounded-2xl flex items-center justify-between shadow-2xs min-w-0">
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="text-[11px] font-bold text-green-800">Tạm tính:</span>
            <span className="text-base sm:text-lg font-black text-green-700 truncate">{formatCurrencyVND(totalPrice)}</span>
          </div>

          {numQty > 0 && numPrice > 0 && (
            <span className="text-[10px] sm:text-[11px] font-bold text-green-800/80 bg-white/80 px-2 py-0.5 rounded-lg border border-green-200 shrink-0 ml-1">
              {numQty} bao × {formatNumberVN(numPrice)} đ
            </span>
          )}
        </div>

        {/* 9. GHI CHÚ TÙY CHỌN */}
        <div>
          <input
            type="text"
            placeholder="Ghi chú (địa chỉ giao, nợ, SĐT... nếu có)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:bg-white focus:ring-1 focus:ring-green-500 outline-none transition min-w-0"
          />
        </div>

        {/* 10. NÚT BÁN HÀNG TO RÕ */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 sm:h-13 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white text-sm sm:text-base font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>BÁN HÀNG</span>
          )}
        </button>
      </form>

      {/* MODAL POPUP: SỬA TÊN, LOẠI BAO & GIÁ (2 HÀNG RỘNG RÃI, KHÔNG STT, CÓ XÁC NHẬN XÓA) */}
      {isProductManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] text-slate-800 relative">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Danh Mục Hàng & Giá</h3>
                  <p className="text-[10px] text-emerald-200">
                    Cấu hình tên, loại bao và giá gốc 50kg ({products.length} hàng)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductManagerOpen(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Danh sách các mặt hàng: 2 Hàng cho mỗi sản phẩm */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2.5">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs shadow-2xs space-y-2"
                >
                  {/* HÀNG 1: TÊN HÀNG HÓA RỘNG RÃI TOÀN BỘ CHIỀU RỘNG */}
                  <div>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => handleUpdateProduct(p.id, "name", e.target.value)}
                      placeholder="Nhập tên hàng hóa..."
                      className="w-full px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
                    />
                  </div>

                  {/* HÀNG 2: GIÁ - Ô TÍCH 25 - Ô TÍCH 50 - THÙNG RÁC */}
                  <div className="flex items-center justify-between gap-1.5">
                    {/* 1. Ô nhập giá */}
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatCurrencyInput(p.price)}
                        onChange={(e) => handleUpdateProduct(p.id, "price", parseCurrencyInput(e.target.value))}
                        placeholder="Giá 50kg..."
                        className="w-full px-2.5 py-1.5 pr-6 text-xs sm:text-sm font-black text-slate-900 bg-white border border-slate-200 rounded-xl outline-none focus:border-green-500 transition"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                        đ
                      </span>
                    </div>

                    {/* 2. Ô tích 25k */}
                    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0 px-2 py-1.5 bg-white border border-slate-200 rounded-xl" title="Cho phép bao 25kg">
                      <input
                        type="checkbox"
                        checked={p.allow25kg !== false}
                        onChange={(e) => handleUpdateProduct(p.id, "allow25kg", e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          p.allow25kg !== false
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        25k
                      </span>
                    </label>

                    {/* 3. Ô tích 50k */}
                    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0 px-2 py-1.5 bg-white border border-slate-200 rounded-xl" title="Cho phép bao 50kg">
                      <input
                        type="checkbox"
                        checked={p.allow50kg !== false}
                        onChange={(e) => handleUpdateProduct(p.id, "allow50kg", e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          p.allow50kg !== false
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        50k
                      </span>
                    </label>

                    {/* 4. Thùng rác xóa hàng */}
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(p)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-90 border border-slate-200 rounded-xl transition shrink-0 bg-white"
                      title="Xóa mặt hàng này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleAddNewProduct}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Hàng Mới</span>
              </button>

              <button
                type="button"
                onClick={() => setIsProductManagerOpen(false)}
                className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
              >
                Xong
              </button>
            </div>

            {/* HỘP THOẠI XÁC NHẬN XÓA MẶT HÀNG */}
            {deletingProduct && (
              <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                <div className="bg-white rounded-2xl p-4 shadow-2xl border border-slate-200 max-w-xs w-full text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Xác Nhận Xóa Hàng?</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Bạn có chắc muốn xóa mặt hàng:
                      <br />
                      <strong className="text-red-600 font-black">"{deletingProduct.name}"</strong>?
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(null)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteProduct(deletingProduct.id);
                        setDeletingProduct(null);
                      }}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
                    >
                      Xóa Luôn
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Chọn & Quản lý Khách Quen */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={(name) => {
          setSelectedFrequentCustomer(name);
          setIsRetail(false);
          setCustomCustomerInput("");
        }}
        currentSelectedName={selectedFrequentCustomer}
      />
    </div>
  );
}