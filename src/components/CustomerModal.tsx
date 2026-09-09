"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Customer } from "@/types";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import {
  X,
  Search,
  UserPlus,
  Trash2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (name: string) => void;
  currentSelectedName?: string;
}

const DEFAULT_CUSTOMERS: string[] = [
  "Anh Ba (Chợ Mới)",
  "Anh Bảy",
  "Anh Cường (Trại Heo)",
  "Anh Dũng (Cầu Kênh)",
  "Anh Hải",
  "Anh Hùng",
  "Anh Khoa",
  "Anh Long",
  "Anh Minh (Gạo Sạch)",
  "Anh Nam",
  "Anh Phong",
  "Anh Quân",
  "Anh Sơn",
  "Anh Thắng",
  "Anh Tuấn",
  "Bác Ba",
  "Bác Bảy",
  "Bác Năm",
  "Bác Sáu",
  "Bác Tám",
  "Chị Bích",
  "Chị Cúc",
  "Chị Dung",
  "Chị Hạnh",
  "Chị Hoa (Trại Gà)",
  "Chị Hương",
  "Chị Lan",
  "Chị Mai",
  "Chị Nga",
  "Chị Oanh",
  "Chị Phương",
  "Chị Quỳnh",
  "Chị Thảo",
  "Chị Trang",
  "Chị Yến",
  "Chú Bảy (Ao Cá)",
  "Chú Chín",
  "Chú Mười",
  "Chú Năm",
  "Chú Sáu",
  "Cô Ba",
  "Cô Bảy",
  "Cô Chín",
  "Cô Năm",
  "Cô Sáu",
];

export default function CustomerModal({
  isOpen,
  onClose,
  onSelectCustomer,
  currentSelectedName,
}: CustomerModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Long-press detection timer ref
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // 1. Tải danh sách khách quen
  useEffect(() => {
    let unsubscribe = () => {};

    if (isFirebaseConfigured() && db) {
      try {
        const custCol = collection(db, "customers");
        unsubscribe = onSnapshot(
          custCol,
          (snapshot) => {
            if (!snapshot.empty) {
              const list: Customer[] = [];
              snapshot.forEach((d) => {
                const data = d.data();
                list.push({
                  id: d.id,
                  name: data.name || "",
                  phone: data.phone || "",
                  address: data.address || "",
                  createdAt: data.createdAt || Date.now(),
                });
              });
              setCustomers(list);
            } else {
              initDefaultCustomers();
            }
          },
          (err) => {
            console.warn("Lỗi Firestore customers, dùng localStorage:", err);
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
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ban_le_customers");
      if (saved) {
        try {
          setCustomers(JSON.parse(saved));
          return;
        } catch (e) {
          console.error("Lỗi đọc khách quen:", e);
        }
      }
      initDefaultCustomers();
    }
  };

  const initDefaultCustomers = () => {
    const list: Customer[] = DEFAULT_CUSTOMERS.map((name, index) => ({
      id: "cust_" + (index + 1),
      name,
      createdAt: Date.now() - index * 1000,
    }));
    setCustomers(list);
    saveToLocal(list);
  };

  const saveToLocal = (list: Customer[]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ban_le_customers", JSON.stringify(list));
    }
  };

  // 2. Thêm khách quen mới (dùng chung cho cả form và thêm nhanh)
  const addCustomerByName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Kiểm tra trùng
    if (customers.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Tên khách hàng này đã có trong danh sách!");
      return;
    }

    const newCust: Customer = {
      id: "cust_" + Date.now(),
      name: trimmed,
      createdAt: Date.now(),
    };

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = await addDoc(collection(db, "customers"), {
          name: trimmed,
          createdAt: Date.now(),
        });
        newCust.id = docRef.id;
      } catch (err) {
        console.warn("Lỗi lưu khách quen Firebase:", err);
      }
    }

    const updated = [...customers, newCust];
    setCustomers(updated);
    saveToLocal(updated);
    setNewCustomerName("");
    setSearchTerm("");
    setShowAddForm(false);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      alert("Vui lòng nhập tên khách quen!");
      return;
    }
    await addCustomerByName(newCustomerName);
  };

  // Thêm nhanh: khi tìm không ra, bấm "Thêm mới" sẽ tự thêm luôn searchTerm
  const handleQuickAdd = async () => {
    const trimmed = searchTerm.trim();
    if (trimmed && sortedAndFiltered.length === 0) {
      await addCustomerByName(trimmed);
    } else {
      setShowAddForm(!showAddForm);
      if (!showAddForm && trimmed) {
        setNewCustomerName(trimmed);
      }
    }
  };

  // 3. Xóa khách quen
  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;

    const custId = deletingCustomer.id;

    // Cập nhật UI và đóng modal lập tức (Optimistic Update)
    const updated = customers.filter((c) => c.id !== custId);
    setCustomers(updated);
    saveToLocal(updated);
    setDeletingCustomer(null);

    // Gọi Firebase chạy ngầm
    if (isFirebaseConfigured() && db && custId) {
      try {
        await deleteDoc(doc(db, "customers", custId));
      } catch (err) {
        console.warn("Lỗi xóa khách quen Firebase:", err);
      }
    }
  };

  // Long press handlers
  const handleTouchStart = (customer: Customer) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setDeletingCustomer(customer);
    }, 600); // Nhấn giữ 600ms sẽ kích hoạt xóa
  };

  const handleTouchEnd = (customer: Customer) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      onSelectCustomer(customer.name);
      onClose();
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 4. Sắp xếp theo bảng chữ cái A-Z và lọc tìm kiếm
  const sortedAndFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return customers
      .filter((c) => c.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
  }, [customers, searchTerm]);

  // Gom nhóm theo chữ cái đầu (A, B, C...)
  const groupedByLetter = useMemo(() => {
    const groups: Record<string, Customer[]> = {};
    sortedAndFiltered.forEach((cust) => {
      const firstChar = cust.name.trim().charAt(0).toUpperCase();
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(cust);
    });
    return groups;
  }, [sortedAndFiltered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] text-slate-800">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Danh Sách Khách Quen</h3>
              <p className="text-[10px] text-emerald-200">
                Sắp xếp A-Z • Nhấn giữ tên để xóa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm & Nút thêm khách */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên khách quen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-green-500 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleQuickAdd}
              className="py-2 px-3 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs shrink-0 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "Đóng" : "Thêm mới"}</span>
            </button>
          </div>

          {/* Form thêm khách quen mới */}
          {showAddForm && (
            <form onSubmit={handleAddCustomer} className="p-2.5 bg-white border border-green-300 rounded-2xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-green-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-green-600" />
                  Thêm Khách Quen Mới:
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="VD: Chị Lan (Chợ Chiều), Anh Ba..."
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-green-500 font-semibold"
                  autoFocus
                />
                <button
                  type="submit"
                  className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shrink-0 transition"
                >
                  Lưu
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Danh sách khách quen sắp xếp A-Z dạng dàn ngang tự xuống dòng */}
        <div className="p-3 overflow-y-auto flex-1 space-y-2.5">
          {Object.keys(groupedByLetter).length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs space-y-3">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p>Không tìm thấy khách hàng nào phù hợp.</p>
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => addCustomerByName(searchTerm.trim())}
                  className="mx-auto py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Thêm &quot;{searchTerm.trim()}&quot; vào danh bạ
                </button>
              )}
            </div>
          ) : (
            Object.keys(groupedByLetter)
              .sort()
              .map((letter) => (
                <div key={letter} className="space-y-1">
                  {/* Nhãn chữ cái đầu */}
                  <div className="text-[10px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md inline-block">
                    {letter}
                  </div>

                  {/* Dàn thẻ tự co giãn độ dài theo tên, xếp thành hàng ngang & tự động xuống dòng (flex-wrap) */}
                  <div className="flex flex-wrap gap-1.5">
                    {groupedByLetter[letter].map((cust) => {
                      const isSelected = currentSelectedName === cust.name;
                      return (
                        <div
                          key={cust.id || cust.name}
                          onMouseDown={() => handleTouchStart(cust)}
                          onMouseUp={() => handleTouchEnd(cust)}
                          onTouchStart={() => handleTouchStart(cust)}
                          onTouchEnd={() => handleTouchEnd(cust)}
                          onTouchMove={handleTouchMove}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold select-none cursor-pointer transition-all active:scale-95 ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-400/30"
                              : isEditMode
                              ? "bg-red-50 hover:bg-red-100 text-slate-800 border-red-300 shadow-2xs"
                              : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs"
                          }`}
                        >
                          <span>{cust.name}</span>

                          {isSelected && !isEditMode && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />}

                          {isEditMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingCustomer(cust);
                              }}
                              className="p-0.5 rounded-md transition shrink-0 text-red-400 hover:text-red-600 hover:bg-red-100"
                              title="Xóa khách quen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 font-medium">
            Tổng cộng: <strong className="text-slate-800">{customers.length}</strong> khách quen
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`py-1.5 px-3 rounded-xl font-bold transition active:scale-95 ${
                isEditMode
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              {isEditMode ? "Xong" : "Sửa"}
            </button>
            <button
              type="button"
              onClick={() => { setIsEditMode(false); onClose(); }}
              className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Modal Xác Nhận Xóa Khách Quen (Khi nhấn giữ hoặc bấm icon thùng rác) */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-600 pb-1 border-b border-slate-100">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-sm text-slate-800">Xóa Khách Quen</h4>
            </div>

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa khách quen <strong className="text-red-700 font-bold">"{deletingCustomer.name}"</strong> khỏi danh sách không?
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
