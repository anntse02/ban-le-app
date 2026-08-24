"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SaleRecord } from "@/types";
import SalesForm from "@/components/SalesForm";
import SalesTable from "@/components/SalesTable";
import ExportModal from "@/components/ExportModal";
import { getVietnamDate, getVietnamTodayDisplay } from "@/lib/dateUtils";
import { formatCurrencyVND } from "@/lib/formatters";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  Store,
  FileSpreadsheet,
  PlusCircle,
  ClipboardList,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const today = getVietnamDate();

  const [activeTab, setActiveTab] = useState<"form" | "table">("form");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Bộ nhớ đệm lưu đơn hàng theo từng ngày: Record<"YYYY-MM-DD", SaleRecord[]>
  const [dateRecordsMap, setDateRecordsMap] = useState<Record<string, SaleRecord[]>>({});
  // Danh sách các ngày đã tải từ Firestore để tránh đọc lại
  const [loadedDates, setLoadedDates] = useState<Set<string>>(new Set());

  // 1. CHỈ LẮNG NGHE ĐƠN HÀNG CỦA HÔM NAY (Realtime - Tiết kiệm tối đa lượt đọc Firestore)
  useEffect(() => {
    let unsubscribe = () => {};

    if (isFirebaseConfigured() && db) {
      try {
        const todayQuery = query(
          collection(db, "sales"),
          where("date", "==", today)
        );

        unsubscribe = onSnapshot(
          todayQuery,
          (snapshot) => {
            const todayData: SaleRecord[] = [];
            snapshot.forEach((docSnap) => {
              todayData.push({
                id: docSnap.id,
                ...(docSnap.data() as Omit<SaleRecord, "id">),
              });
            });

            todayData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            setDateRecordsMap((prev) => ({
              ...prev,
              [today]: todayData,
            }));
            setLoadedDates((prev) => new Set(prev).add(today));
            setIsFirebaseConnected(true);
          },
          (err) => {
            console.warn("Firestore error, fallback local storage:", err);
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
  }, [today]);

  const loadFromLocalStorage = () => {
    setIsFirebaseConnected(false);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ban_le_records");
      if (saved) {
        try {
          const all: SaleRecord[] = JSON.parse(saved);
          const map: Record<string, SaleRecord[]> = {};
          all.forEach((r) => {
            if (!map[r.date]) map[r.date] = [];
            map[r.date].push(r);
          });
          setDateRecordsMap(map);
        } catch (e) {
          console.error("Lỗi đọc localStorage", e);
        }
      }
    }
  };

  const saveToLocal = (newRecord: SaleRecord) => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ban_le_records");
      const list: SaleRecord[] = saved ? JSON.parse(saved) : [];
      const updated = [newRecord, ...list.filter((r) => r.id !== newRecord.id)];
      localStorage.setItem("ban_le_records", JSON.stringify(updated));
    }
  };

  // 2. TẢI THEO YÊU CẦU KHI CHỌN NGÀY CŨ (On-Demand Loading)
  const loadDateOnDemand = useCallback(
    async (dateToLoad: string) => {
      if (dateToLoad === today || loadedDates.has(dateToLoad)) {
        return;
      }

      if (isFirebaseConfigured() && db) {
        try {
          const dateQuery = query(
            collection(db, "sales"),
            where("date", "==", dateToLoad)
          );
          const snap = await getDocs(dateQuery);
          const dateData: SaleRecord[] = [];
          snap.forEach((docSnap) => {
            dateData.push({
              id: docSnap.id,
              ...(docSnap.data() as Omit<SaleRecord, "id">),
            });
          });

          dateData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          setDateRecordsMap((prev) => ({
            ...prev,
            [dateToLoad]: dateData,
          }));
          setLoadedDates((prev) => new Set(prev).add(dateToLoad));
        } catch (err) {
          console.warn(`Lỗi tải dữ liệu ngày ${dateToLoad}:`, err);
        }
      }
    },
    [today, loadedDates]
  );

  useEffect(() => {
    if (selectedDate && selectedDate !== today) {
      loadDateOnDemand(selectedDate);
    }
  }, [selectedDate, today, loadDateOnDemand]);

  // 3. THÊM GIAO DỊCH MỚI
  const handleAddRecord = async (newRecord: Omit<SaleRecord, "id" | "createdAt">) => {
    setLoading(true);
    const recordWithTime: SaleRecord = {
      ...newRecord,
      id: "rec_" + Date.now(),
      createdAt: Date.now(),
    };

    try {
      if (isFirebaseConfigured() && db) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 3000)
        );
        await Promise.race([
          addDoc(collection(db, "sales"), recordWithTime),
          timeoutPromise,
        ]);
      }

      setDateRecordsMap((prev) => {
        const currentList = prev[newRecord.date] || [];
        return {
          ...prev,
          [newRecord.date]: [recordWithTime, ...currentList],
        };
      });
      saveToLocal(recordWithTime);
      setSelectedDate(newRecord.date);
    } catch (err: any) {
      console.warn("Lỗi lưu Firebase, chuyển sang lưu Local:", err);
      setDateRecordsMap((prev) => {
        const currentList = prev[newRecord.date] || [];
        return {
          ...prev,
          [newRecord.date]: [recordWithTime, ...currentList],
        };
      });
      saveToLocal(recordWithTime);
    } finally {
      setLoading(false);
    }
  };

  // 4. XÓA GIAO DỊCH KÈM LÝ DO (Soft Delete)
  const handleDeleteRecord = async (id: string, reason: string) => {
    const targetDate = selectedDate;
    setDateRecordsMap((prev) => {
      const currentList = prev[targetDate] || [];
      const updated = currentList.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            isDeleted: true,
            deleteReason: reason,
            deletedAt: Date.now(),
          };
        }
        return r;
      });
      return {
        ...prev,
        [targetDate]: updated,
      };
    });

    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, "sales", id), {
          isDeleted: true,
          deleteReason: reason,
          deletedAt: Date.now(),
        });
      } catch (err: any) {
        console.warn("Lỗi update Firebase:", err);
      }
    }
  };

  // 5. TẢI DỮ LIỆU ĐỂ XUẤT EXCEL
  const handleFetchExportRecords = useCallback(
    async (
      mode: "range" | "multiday",
      startDate: string,
      endDate: string,
      specificDays: string[]
    ): Promise<SaleRecord[]> => {
      if (isFirebaseConfigured() && db) {
        try {
          if (mode === "range") {
            const rangeQuery = query(
              collection(db, "sales"),
              where("date", ">=", startDate),
              where("date", "<=", endDate)
            );
            const snap = await getDocs(rangeQuery);
            const list: SaleRecord[] = [];
            snap.forEach((d) => {
              list.push({ id: d.id, ...(d.data() as Omit<SaleRecord, "id">) });
            });
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return list.filter((r) => !r.isDeleted);
          } else {
            const results: SaleRecord[] = [];
            for (const day of specificDays) {
              if (dateRecordsMap[day]) {
                results.push(...dateRecordsMap[day]);
              } else {
                const dayQuery = query(
                  collection(db, "sales"),
                  where("date", "==", day)
                );
                const snap = await getDocs(dayQuery);
                snap.forEach((d) => {
                  results.push({ id: d.id, ...(d.data() as Omit<SaleRecord, "id">) });
                });
              }
            }
            results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return results.filter((r) => !r.isDeleted);
          }
        } catch (err) {
          console.warn("Lỗi fetch export:", err);
        }
      }

      const allLoaded = Object.values(dateRecordsMap).flat();
      if (mode === "range") {
        return allLoaded.filter((r) => !r.isDeleted && r.date >= startDate && r.date <= endDate);
      } else {
        const daySet = new Set(specificDays);
        return allLoaded.filter((r) => !r.isDeleted && daySet.has(r.date));
      }
    },
    [dateRecordsMap]
  );

  // Thống kê hôm nay
  const todayRecords = dateRecordsMap[today] || [];
  const todayActiveRecords = todayRecords.filter((r) => !r.isDeleted);
  const todayRevenue = todayActiveRecords.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  const todayBao25 = todayActiveRecords
    .filter((r) => r.bagType === "25kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const todayBao50 = todayActiveRecords
    .filter((r) => r.bagType === "50kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const currentViewRecords = dateRecordsMap[selectedDate] || [];
  const formatVND = (num: number) => formatCurrencyVND(num);

  return (
    <main className="min-h-screen bg-slate-100/70 pb-16 sm:pb-8 text-slate-800">
      {/* Header Sticky Sáng Cực Gọn */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-12 sm:h-13 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center text-white shadow-2xs">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight text-slate-800 flex items-center gap-1">
                SỔ BÁN LẺ
                <span
                  className={`text-[9px] uppercase font-bold px-1 py-0.2 rounded ${
                    isFirebaseConnected
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isFirebaseConnected ? "ONLINE" : "LOCAL"}
                </span>
              </h1>
              <p className="text-[9px] text-slate-400">
                {getVietnamTodayDisplay()} • Giờ VN (GMT+7)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-2xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-2xl mx-auto px-2.5 sm:px-4 pt-2 space-y-2">
        {/* THANH CHỌN THẺ NẰM NGAY ĐẦU TRANG (DƯỚI HEADER) */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-200/90 p-1 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "form"
                ? "bg-white text-green-700 shadow-xs scale-[1.01]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>📝 Nhập Bán Hàng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "table"
                ? "bg-white text-green-700 shadow-xs scale-[1.01]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>📋 Sổ Đơn Hàng ({todayActiveRecords.length})</span>
          </button>
        </div>

        {/* NỘI DUNG THẺ */}
        {activeTab === "form" ? (
          <div>
            {/* Thẻ Nhập Bán Hàng thiết kế siêu gọn nằm trọn trong 1 màn hình */}
            <SalesForm onAddRecord={handleAddRecord} loading={loading} />
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Banner Tóm Tắt Doanh Số Hôm Nay ĐÃ ĐƯỢC CHUYỂN VÀO ĐẦU THẺ SỔ ĐƠN HÀNG */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-3 text-white shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/15 rounded-lg">
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-200 font-medium">
                    Hôm nay ({todayActiveRecords.length} đơn):
                  </p>
                  <p className="text-sm sm:text-base font-black">{formatVND(todayRevenue)}</p>
                </div>
              </div>

              <div className="text-right text-xs space-y-0.5">
                <div className="bg-white/10 px-2 py-0.5 rounded-md inline-block">
                  <span className="text-emerald-200 text-[10px]">Bao 25kg: </span>
                  <span className="font-bold text-white text-xs">{todayBao25} bao</span>
                </div>
                <br />
                <div className="bg-white/10 px-2 py-0.5 rounded-md inline-block">
                  <span className="text-teal-200 text-[10px]">Bao 50kg: </span>
                  <span className="font-bold text-white text-xs">{todayBao50} bao</span>
                </div>
              </div>
            </div>

            {/* Bảng sổ đơn hàng */}
            <SalesTable
              records={currentViewRecords}
              onDeleteRecord={handleDeleteRecord}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>
        )}
      </div>

      {/* Modal Xuất Báo Cáo Excel */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onFetchRecords={handleFetchExportRecords}
      />
    </main>
  );
}