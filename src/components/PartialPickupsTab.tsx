"use client";

import React, { useState } from "react";
import { SaleRecord } from "@/types";
import { formatVietnamDisplayDate } from "@/lib/dateUtils";
import { formatCurrencyVND, formatNumberVN, parseQuantityInput } from "@/lib/formatters";
import {
  Package,
  UserCheck,
  CheckCircle2,
  History,
  Calendar,
  Layers,
  Search,
} from "lucide-react";

interface PartialPickupsTabProps {
  records: SaleRecord[];
  onAddPickup: (recordId: string, pickupQuantity: number, note?: string) => Promise<void>;
  onDeleteRecord?: (id: string, reason: string) => Promise<void>;
}

export default function PartialPickupsTab({
  records,
  onAddPickup,
}: PartialPickupsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // State cho form lấy hàng của từng đơn
  const [pickupInputMap, setPickupInputMap] = useState<Record<string, number | "">>({});
  const [pickupNoteMap, setPickupNoteMap] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // CHỈ LẤY CÁC ĐƠN ĐANG GỬI KHO / CHƯA LẤY ĐỦ SỐ LƯỢNG (Chưa hoàn tất)
  const pendingRecords = records.filter(
    (r) =>
      r.isPartialPickup &&
      r.pickupStatus !== "completed" &&
      (Number(r.pickedQuantity) || 0) < (Number(r.quantity) || 0) &&
      !r.isDeleted
  );

  const filteredRecords = pendingRecords.filter((rec) => {
    const matchesSearch =
      (rec.customerName && rec.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      rec.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.seller && rec.seller.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.note && rec.note.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const handleConfirmPickup = async (rec: SaleRecord) => {
    if (!rec.id) return;
    const inputVal = pickupInputMap[rec.id];
    const qty = typeof inputVal === "number" ? inputVal : 1;
    const remaining = Math.max(0, (rec.quantity || 0) - (rec.pickedQuantity || 0));

    if (qty <= 0) {
      alert("Số lượng bao lấy phải lớn hơn 0!");
      return;
    }
    if (qty > remaining) {
      alert(`Số lượng lấy (${qty} bao) vượt quá số bao còn lại (${remaining} bao)!`);
      return;
    }

    setSubmittingId(rec.id);
    try {
      const note = pickupNoteMap[rec.id] || "";
      await onAddPickup(rec.id, qty, note);
      // Reset input
      setPickupInputMap((prev) => ({ ...prev, [rec.id!]: "" }));
      setPickupNoteMap((prev) => ({ ...prev, [rec.id!]: "" }));
    } catch (e: any) {
      alert("Lỗi khi xác nhận lấy hàng: " + e.message);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Thẻ */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-slate-800">
                Đơn Khách Lấy Nhiều Lần (Gửi Kho)
              </h2>
              <p className="text-[10px] text-slate-400">
                Khi khách lấy đủ số lượng, đơn sẽ tự động chuyển về Sổ Đơn Hàng
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {pendingRecords.length} đơn đang gửi
          </span>
        </div>

        {/* Ô Tìm kiếm */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm tên khách quen, mặt hàng, người bán..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Danh Sách Các Đơn Lấy Nhiều Lần Đang Gửi Kho */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
          <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          Hiện không có đơn nào đang gửi lại / lấy dở.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((rec, index) => {
            const totalQty = Number(rec.quantity) || 0;
            const pickedQty = Number(rec.pickedQuantity) || 0;
            const remainingQty = Math.max(0, totalQty - pickedQty);
            const percent = totalQty > 0 ? Math.min(100, Math.round((pickedQty / totalQty) * 100)) : 100;
            const currentInput = pickupInputMap[rec.id!] ?? (remainingQty > 0 ? 1 : "");

            return (
              <div
                key={rec.id || index}
                className="bg-white rounded-2xl border border-amber-200 p-3.5 shadow-xs space-y-3 transition-all"
              >
                {/* 1. Header Đơn Hàng */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-slate-800">#{index + 1}</span>
                    <span className="text-slate-400">•</span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-700">{formatVietnamDisplayDate(rec.date)}</span>
                    {rec.time && <span className="text-[11px] text-slate-400">{rec.time}</span>}

                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                      ⏳ Còn gửi {remainingQty} bao
                    </span>

                    {rec.paymentStatus === "unpaid" ? (
                      <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-red-100 text-red-700 border border-red-200">
                        Chưa thu
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đã thu
                      </span>
                    )}
                  </div>

                  <div>
                    {rec.seller === "Hằng" ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-100 text-pink-700">
                        Hằng
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-700">
                        Gấm
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Chi Tiết Khách & Mặt Hàng */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-blue-700 font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Khách: <strong>{rec.customerName || "Khách lẻ"}</strong></span>
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{rec.itemName}</span>
                      {rec.bagType && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {rec.bagType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Đơn giá: <strong className="text-slate-800">{formatNumberVN(rec.unitPrice)} đ/bao</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Tổng tiền:</span>
                    <span className="text-sm sm:text-base font-black text-green-700">
                      {formatCurrencyVND(rec.totalPrice)}
                    </span>
                  </div>
                </div>

                {/* 3. TIẾN ĐỘ LẤY HÀNG (Tổng Đã Mua / Đã Lấy / Còn Lại) */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">
                      📦 Mua: <strong className="text-slate-900">{totalQty} bao</strong>
                    </span>
                    <span className="text-emerald-700">
                      Đã lấy: <strong>{pickedQty} bao</strong>
                    </span>
                    <span className="text-amber-700">
                      Còn lại: <strong>{remainingQty} bao</strong>
                    </span>
                  </div>

                  {/* Thanh Progress bar */}
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* 4. LỊCH SỬ CÁC LẦN LẤY HÀNG */}
                {rec.pickupHistory && rec.pickupHistory.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                      <History className="w-3 h-3 text-teal-600" />
                      Lịch sử các lần lấy hàng ({rec.pickupHistory.length} lần):
                    </span>
                    <div className="space-y-1 bg-slate-50/70 p-2 rounded-xl border border-slate-200 max-h-32 overflow-y-auto">
                      {rec.pickupHistory.map((event, eIdx) => (
                        <div
                          key={event.id || eIdx}
                          className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 last:border-0"
                        >
                          <span className="font-bold text-slate-700">
                            Lần {eIdx + 1}: {formatVietnamDisplayDate(event.date)} {event.time || ""}
                          </span>
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            + {event.quantity} bao
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. FORM THAO TÁC LẤY HÀNG CHO LẦN NÀY */}
                <div className="p-2.5 bg-emerald-50/40 border border-emerald-300/80 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-emerald-900 block">
                    🚚 Nhập số bao lấy cho lần này:
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center w-32 shrink-0 h-10 rounded-xl overflow-hidden border border-emerald-400 bg-white">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(currentInput) || 1;
                          setPickupInputMap((prev) => ({
                            ...prev,
                            [rec.id!]: Math.max(1, cur - 1),
                          }));
                        }}
                        className="w-9 h-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center select-none"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={currentInput}
                        onChange={(e) => {
                          const val = parseQuantityInput(e.target.value, remainingQty);
                          setPickupInputMap((prev) => ({
                            ...prev,
                            [rec.id!]: val,
                          }));
                        }}
                        className="w-full text-center text-sm font-black text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(currentInput) || 0;
                          setPickupInputMap((prev) => ({
                            ...prev,
                            [rec.id!]: Math.min(remainingQty, cur + 1),
                          }));
                        }}
                        className="w-9 h-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center select-none"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConfirmPickup(rec)}
                      disabled={submittingId === rec.id}
                      className="flex-1 h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {submittingId === rec.id ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Xác nhận lấy hàng</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
