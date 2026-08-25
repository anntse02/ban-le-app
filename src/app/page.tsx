"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SaleRecord, PickupEvent } from "@/types";
import SalesForm from "@/components/SalesForm";
import SalesTable from "@/components/SalesTable";
import PartialPickupsTab from "@/components/PartialPickupsTab";
import ExportModal from "@/components/ExportModal";
import { getVietnamDate, getVietnamTime, getVietnamTodayDisplay } from "@/lib/dateUtils";
import { formatCurrencyVND } from "@/lib/formatters";
import { db, isFirebaseConfigured, sanitizeForFirestore } from "@/lib/firebase";
import {
  collection,
  addDoc,
  setDoc,
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
  Layers,
} from "lucide-react";

export default function HomePage() {
  const today = getVietnamDate();

  const [activeTab, setActiveTab] = useState<"form" | "table" | "pickups">("form");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Bộ nhớ đệm lưu đơn hàng theo từng ngày: Record<"YYYY-MM-DD", SaleRecord[]>
  const [dateRecordsMap, setDateRecordsMap] = useState<Record<string, SaleRecord[]>>({});
  // Danh sách các đơn lấy nhiều lần (đang lưu giữ / gửi kho)
  const [partialRecords, setPartialRecords] = useState<SaleRecord[]>([]);
  // Danh sách các ngày đã tải từ Firestore để tránh đọc lại
  const [loadedDates, setLoadedDates] = useState<Set<string>>(new Set());

  // 1. LẮNG NGHE ĐƠN HÀNG HÔM NAY & CÁC ĐƠN LẤY NHIỀU LẦN ĐANG DỞ
  useEffect(() => {
    let unsubscribeToday = () => {};
    let unsubscribePartials = () => {};

    if (isFirebaseConfigured() && db) {
      try {
        // Lắng nghe đơn hôm nay
        const todayQuery = query(
          collection(db, "sales"),
          where("date", "==", today)
        );

        unsubscribeToday = onSnapshot(
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
            console.warn("Firestore listener error, fallback local storage:", err);
            loadFromLocalStorage();
          }
        );

        // Lắng nghe các đơn lấy nhiều lần
        const partialsQuery = query(
          collection(db, "sales"),
          where("isPartialPickup", "==", true)
        );

        unsubscribePartials = onSnapshot(
          partialsQuery,
          (snapshot) => {
            const pData: SaleRecord[] = [];
            snapshot.forEach((docSnap) => {
              pData.push({
                id: docSnap.id,
                ...(docSnap.data() as Omit<SaleRecord, "id">),
              });
            });
            pData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setPartialRecords(pData);
          },
          (err) => {
            console.warn("Firestore partials listener error:", err);
          }
        );
      } catch (e) {
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }

    return () => {
      unsubscribeToday();
      unsubscribePartials();
    };
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
          setPartialRecords(all.filter((r) => r.isPartialPickup));
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
        try {
          const newDocRef = doc(collection(db, "sales"));
          recordWithTime.id = newDocRef.id;
          // Ghi lên Firebase Realtime an toàn
          setDoc(newDocRef, sanitizeForFirestore(recordWithTime)).catch((err) => {
            console.warn("Lỗi đồng bộ Firebase:", err);
          });
        } catch (fbErr) {
          console.warn("Lỗi khởi tạo docRef Firestore:", fbErr);
        }
      }

      setDateRecordsMap((prev) => {
        const currentList = prev[newRecord.date] || [];
        return {
          ...prev,
          [newRecord.date]: [recordWithTime, ...currentList],
        };
      });

      if (newRecord.isPartialPickup) {
        setPartialRecords((prev) => [recordWithTime, ...prev.filter((r) => r.id !== recordWithTime.id)]);
      }

      saveToLocal(recordWithTime);
      setSelectedDate(newRecord.date);
    } catch (err: any) {
      console.warn("Lỗi lưu đơn hàng:", err);
      setDateRecordsMap((prev) => {
        const currentList = prev[newRecord.date] || [];
        return {
          ...prev,
          [newRecord.date]: [recordWithTime, ...currentList],
        };
      });
      if (newRecord.isPartialPickup) {
        setPartialRecords((prev) => [recordWithTime, ...prev.filter((r) => r.id !== recordWithTime.id)]);
      }
      saveToLocal(recordWithTime);
    } finally {
      setLoading(false);
    }
  };

  // 4. XỬ LÝ LẤY HÀNG NHIỀU LẦN (Thao tác lấy hàng của từng lần)
  const handleAddPickup = async (recordId: string, pickupQuantity: number, pickupNote?: string) => {
    const autoDate = getVietnamDate();
    const autoTime = getVietnamTime();

    const newEvent: PickupEvent = {
      id: "pick_" + Date.now(),
      date: autoDate,
      time: autoTime,
      quantity: pickupQuantity,
      note: pickupNote || "",
      createdAt: Date.now(),
    };

    let updatedTargetRecord: SaleRecord | null = null;

    // Cập nhật state partialRecords
    setPartialRecords((prev) => {
      return prev.map((r) => {
        if (r.id === recordId) {
          const currentPicked = Number(r.pickedQuantity) || 0;
          const newPicked = currentPicked + pickupQuantity;
          const isDone = newPicked >= (Number(r.quantity) || 0);
          const history = r.pickupHistory ? [...r.pickupHistory, newEvent] : [newEvent];

          const updated: SaleRecord = {
            ...r,
            pickedQuantity: newPicked,
            pickupStatus: isDone ? "completed" : "pending",
            pickupHistory: history,
            ...(isDone ? { completedAt: Date.now() } : (r.completedAt ? { completedAt: r.completedAt } : {})),
          };
          updatedTargetRecord = updated;
          return updated;
        }
        return r;
      });
    });

    // Cập nhật trong dateRecordsMap (sổ đơn hàng)
    if (updatedTargetRecord) {
      const rec = updatedTargetRecord as SaleRecord;
      setDateRecordsMap((prev) => {
        const list = prev[rec.date] || [];
        return {
          ...prev,
          [rec.date]: list.map((item) => (item.id === recordId ? rec : item)),
        };
      });
      saveToLocal(rec);
    }

    // Cập nhật Firebase
    if (isFirebaseConfigured() && db) {
      try {
        const found = partialRecords.find((r) => r.id === recordId);
        if (found) {
          const currentPicked = Number(found.pickedQuantity) || 0;
          const newPicked = currentPicked + pickupQuantity;
          const isDone = newPicked >= (Number(found.quantity) || 0);
          const history = found.pickupHistory ? [...found.pickupHistory, newEvent] : [newEvent];

          const updatePayload: any = {
            pickedQuantity: newPicked,
            pickupStatus: isDone ? "completed" : "pending",
            pickupHistory: history,
          };
          if (isDone) {
            updatePayload.completedAt = Date.now();
          } else if (found.completedAt) {
            updatePayload.completedAt = found.completedAt;
          }

          await updateDoc(doc(db, "sales", recordId), sanitizeForFirestore(updatePayload));
        }
      } catch (err) {
        console.warn("Lỗi cập nhật pickup Firestore:", err);
      }
    }
  };

  // 5. XÓA GIAO DỊCH KÈM LÝ DO (Soft Delete)
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

    setPartialRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isDeleted: true, deleteReason: reason, deletedAt: Date.now() } : r))
    );

    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, "sales", id), sanitizeForFirestore({
          isDeleted: true,
          deleteReason: reason,
          deletedAt: Date.now(),
        }));
      } catch (err: any) {
        console.warn("Lỗi update Firebase:", err);
      }
    }
  };

  // 6. TẢI DỮ LIỆU ĐỂ XUẤT EXCEL
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

  // Điều kiện để một đơn xuất hiện trong Sổ Đơn Hàng:
  // 1. Là đơn bán bình thường (!isPartialPickup)
  // 2. HOẶC là đơn lấy nhiều lần nhưng ĐÃ LẤY ĐỦ HẾT (pickupStatus === "completed")
  const isRecordInSalesBook = (r: SaleRecord) => {
    if (!r.isPartialPickup) return true;
    return r.pickupStatus === "completed";
  };

  // Thống kê hôm nay (chỉ tính đơn bán thường và đơn đã lấy đủ)
  const todayRecords = (dateRecordsMap[today] || []).filter(isRecordInSalesBook);
  const todayActiveRecords = todayRecords.filter((r) => !r.isDeleted);
  const todayRevenue = todayActiveRecords.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  const todayBao25 = todayActiveRecords
    .filter((r) => r.bagType === "25kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const todayBao50 = todayActiveRecords
    .filter((r) => r.bagType === "50kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Đếm số đơn đang gửi kho / lấy dở
  const pendingPickupsCount = partialRecords.filter(
    (r) => r.isPartialPickup && r.pickupStatus !== "completed" && !r.isDeleted
  ).length;

  const currentViewRecords = (dateRecordsMap[selectedDate] || []).filter(isRecordInSalesBook);
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
        {/* THANH CHỌN THẺ NẰM NGAY ĐẦU TRANG (3 THẺ GỌN ĐẸP) */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/90 p-1 rounded-xl shadow-2xs text-[11px] font-bold">
          {/* Tab 1: Nhập Bán */}
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`py-1.5 sm:py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeTab === "form"
                ? "bg-white text-green-700 shadow-xs scale-[1.01]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="truncate">Nhập Bán</span>
          </button>

          {/* Tab 2: Lấy Nhiều Lần (Ở GIỮA) */}
          <button
            type="button"
            onClick={() => setActiveTab("pickups")}
            className={`py-1.5 sm:py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeTab === "pickups"
                ? "bg-white text-teal-700 shadow-xs scale-[1.01]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="truncate">
              Lấy Nhiều Lần {pendingPickupsCount > 0 && `(${pendingPickupsCount})`}
            </span>
          </button>

          {/* Tab 3: Sổ Đơn (Ở CUỐI) */}
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`py-1.5 sm:py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeTab === "table"
                ? "bg-white text-green-700 shadow-xs scale-[1.01]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="truncate">Sổ Đơn ({todayActiveRecords.length})</span>
          </button>
        </div>

        {/* NỘI DUNG THẺ */}
        {activeTab === "form" ? (
          <div>
            <SalesForm onAddRecord={handleAddRecord} loading={loading} />
          </div>
        ) : activeTab === "table" ? (
          <div className="space-y-2.5">
            {/* Banner Tóm Tắt Doanh Số Hôm Nay */}
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
        ) : (
          <div>
            {/* Thẻ Quản Lý Các Đơn Khách Lấy Nhiều Lần */}
            <PartialPickupsTab
              records={partialRecords}
              onAddPickup={handleAddPickup}
              onDeleteRecord={handleDeleteRecord}
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