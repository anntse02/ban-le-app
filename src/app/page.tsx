"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SaleRecord, PickupEvent, ProductItem, StockInRecord } from "@/types";
import SalesForm from "@/components/SalesForm";
import InstallBanner from "@/components/InstallBanner";
import SalesTable from "@/components/SalesTable";
import PartialPickupsTab from "@/components/PartialPickupsTab";
import InventoryTab from "@/components/InventoryTab";
import ExportModal from "@/components/ExportModal";
import PinLockScreen from "@/components/PinLockScreen";
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
  Boxes,
  AlertTriangle,
  X,
  Lock,
  ChevronUp,
  ChevronDown,
  User,
  CheckCircle2,
} from "lucide-react";

const INITIAL_PRODUCTS: ProductItem[] = [
  { id: "p1", name: "Cám lợn (heo)", price: 380000, allow25kg: true, allow50kg: true, stock25kg: 25, stock50kg: 40, minStockAlert: 5 },
  { id: "p2", name: "Cám gà / vịt", price: 350000, allow25kg: true, allow50kg: true, stock25kg: 18, stock50kg: 32, minStockAlert: 5 },
  { id: "p3", name: "Cám bò / dê", price: 290000, allow25kg: true, allow50kg: true, stock25kg: 10, stock50kg: 20, minStockAlert: 5 },
  { id: "p4", name: "Gạo ST25", price: 420000, allow25kg: true, allow50kg: true, stock25kg: 30, stock50kg: 50, minStockAlert: 5 },
  { id: "p5", name: "Gạo Đài Thơm", price: 360000, allow25kg: true, allow50kg: true, stock25kg: 20, stock50kg: 35, minStockAlert: 5 },
  { id: "p6", name: "Gạo Bắc Hương", price: 340000, allow25kg: true, allow50kg: true, stock25kg: 15, stock50kg: 25, minStockAlert: 5 },
  { id: "p7", name: "Phân bón NPK", price: 450000, allow25kg: true, allow50kg: true, stock25kg: 12, stock50kg: 28, minStockAlert: 5 },
  { id: "p8", name: "Đạm Ure", price: 390000, allow25kg: true, allow50kg: true, stock25kg: 14, stock50kg: 22, minStockAlert: 5 },
  { id: "p9", name: "Phân Lân / Kali", price: 310000, allow25kg: true, allow50kg: true, stock25kg: 8, stock50kg: 18, minStockAlert: 5 },
  { id: "p10", name: "Ngô hạt / Bột ngô", price: 280000, allow25kg: true, allow50kg: true, stock25kg: 16, stock50kg: 30, minStockAlert: 5 },
  { id: "p11", name: "Đường cát trắng", price: 520000, allow25kg: true, allow50kg: true, stock25kg: 10, stock50kg: 15, minStockAlert: 5 },
];

export default function HomePage() {
  const today = getVietnamDate();

  // Mã PIN bảo vệ (1977)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Trạng thái người bán và header
  const [sellerName, setSellerName] = useState<string>("Hằng");
  const [isHeaderExpanded, setIsHeaderExpanded] = useState<boolean>(true);
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("ban_le_auth_unlocked") === "true") {
        setIsUnlocked(true);
      }
    } catch (e) {}
  }, []);

  const handleLockApp = () => {
    try {
      localStorage.removeItem("ban_le_auth_unlocked");
    } catch (e) {}
    setIsUnlocked(false);
  };

  const [activeTab, setActiveTab] = useState<"form" | "pickups" | "table">("form");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Danh mục hàng & Tồn kho
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  // Danh sách phiếu nhập hàng
  const [stockInRecords, setStockInRecords] = useState<StockInRecord[]>([]);

  // Bộ nhớ đệm lưu đơn hàng theo từng ngày: Record<"YYYY-MM-DD", SaleRecord[]>
  const [dateRecordsMap, setDateRecordsMap] = useState<Record<string, SaleRecord[]>>({});
  // Danh sách các đơn lấy nhiều lần (đang lưu giữ / gửi kho)
  const [partialRecords, setPartialRecords] = useState<SaleRecord[]>([]);
  // Danh sách các ngày đã tải từ Firestore để tránh đọc lại
  const [loadedDates, setLoadedDates] = useState<Set<string>>(new Set());

  // 1. LẮNG NGHE ĐƠN HÀNG HÔM NAY, ĐƠN GỬI KHO, DANH MỤC HÀNG & PHIẾU NHẬP KHO
  useEffect(() => {
    let unsubscribeToday = () => {};
    let unsubscribePartials = () => {};
    let unsubscribeProducts = () => {};
    let unsubscribeStockIn = () => {};

    if (isFirebaseConfigured() && db) {
      try {
        // A. Lắng nghe đơn hôm nay
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

        // B. Lắng nghe các đơn lấy nhiều lần
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

        // C. Lắng nghe danh mục hàng & số lượng tồn kho
        const prodDocRef = doc(db, "settings", "products");
        unsubscribeProducts = onSnapshot(
          prodDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (Array.isArray(data?.list) && data.list.length > 0) {
                setProducts(data.list);
                try {
                  localStorage.setItem("ban_le_products", JSON.stringify(data.list));
                } catch (e) {}
              }
            }
          },
          (err) => {
            console.warn("Firestore products listener error:", err);
          }
        );

        // D. Lắng nghe danh sách phiếu nhập kho
        const stockInQuery = query(collection(db, "stock_in_records"));
        unsubscribeStockIn = onSnapshot(
          stockInQuery,
          (snapshot) => {
            const stkData: StockInRecord[] = [];
            snapshot.forEach((docSnap) => {
              stkData.push({
                id: docSnap.id,
                ...(docSnap.data() as Omit<StockInRecord, "id">),
              });
            });
            stkData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setStockInRecords(stkData);
            try {
              localStorage.setItem("ban_le_stock_in_records", JSON.stringify(stkData));
            } catch (e) {}
          },
          (err) => {
            console.warn("Firestore stock_in listener error:", err);
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
      unsubscribeProducts();
      unsubscribeStockIn();
    };
  }, [today]);

  const loadFromLocalStorage = () => {
    setIsFirebaseConnected(false);
    if (typeof window !== "undefined") {
      // 1. Đơn bán
      const savedSales = localStorage.getItem("ban_le_records");
      if (savedSales) {
        try {
          const all: SaleRecord[] = JSON.parse(savedSales);
          const map: Record<string, SaleRecord[]> = {};
          all.forEach((r) => {
            if (!map[r.date]) map[r.date] = [];
            map[r.date].push(r);
          });
          setDateRecordsMap(map);
          setPartialRecords(all.filter((r) => r.isPartialPickup));
        } catch (e) {
          console.error("Lỗi đọc localStorage sales:", e);
        }
      }

      // 2. Danh mục sản phẩm & tồn kho
      const savedProducts = localStorage.getItem("ban_le_products");
      if (savedProducts) {
        try {
          const parsed = JSON.parse(savedProducts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
          }
        } catch (e) {}
      }

      // 3. Phiếu nhập kho
      const savedStockIn = localStorage.getItem("ban_le_stock_in_records");
      if (savedStockIn) {
        try {
          const parsed = JSON.parse(savedStockIn);
          if (Array.isArray(parsed)) {
            setStockInRecords(parsed);
          }
        } catch (e) {}
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

  // 3. CẬP NHẬT TỒN KHO MẶT HÀNG (KIỂM KÊ)
  const handleUpdateProductStock = async (
    productId: string,
    stock25kg?: number,
    stock50kg?: number,
    minStockAlert?: number
  ) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          stock25kg: stock25kg !== undefined ? stock25kg : p.stock25kg,
          stock50kg: stock50kg !== undefined ? stock50kg : p.stock50kg,
          minStockAlert: minStockAlert !== undefined ? minStockAlert : p.minStockAlert,
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    setProducts(updated);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(updated));
    } catch (e) {}

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, "settings", "products"), sanitizeForFirestore({
          list: updated,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi lưu tồn kho lên Firebase:", err);
      }
    }
  };

  // 3.1. THÊM MẶT HÀNG MỚI KÈM SỐ LƯỢNG TỒN BAN ĐẦU

  const handleResetAllStock = async () => {
    const updated = products.map((p) => ({
      ...p,
      stock25kg: 0,
      stock50kg: 0,
      updatedAt: Date.now(),
    }));

    setProducts(updated);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(updated));
    } catch (e) {}

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, "settings", "products"), sanitizeForFirestore({
          list: updated,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi lưu tồn kho lên Firebase:", err);
      }
    }
  };

  const handleAddNewProduct = async (newProd: Omit<ProductItem, "id">): Promise<ProductItem> => {
    const newItem: ProductItem = {
      ...newProd,
      id: "p_" + Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...products, newItem];
    setProducts(updated);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(updated));
    } catch (e) {}

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, "settings", "products"), sanitizeForFirestore({
          list: updated,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi lưu sản phẩm mới Firebase:", err);
      }
    }
    return newItem;
  };

  // 3.2. CẬP NHẬT ĐẦY ĐỦ THÔNG TIN MẶT HÀNG (TÊN, GIÁ, LOẠI BAO, TỒN KHO)
  const handleUpdateProductFull = async (
    productId: string,
    updatedData: Partial<ProductItem>
  ) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          ...updatedData,
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    setProducts(updated);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(updated));
    } catch (e) {}

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, "settings", "products"), sanitizeForFirestore({
          list: updated,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi lưu sản phẩm lên Firebase:", err);
      }
    }
  };

  // 3.3. XÓA MẶT HÀNG KHỎI DANH MỤC
  const handleDeleteProduct = async (productId: string) => {
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    try {
      localStorage.setItem("ban_le_products", JSON.stringify(updated));
    } catch (e) {}

    if (isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, "settings", "products"), sanitizeForFirestore({
          list: updated,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi xóa sản phẩm Firebase:", err);
      }
    }
  };

  // 4. TẠO PHIẾU NHẬP HÀNG MỚI (TỰ ĐỘNG TĂNG TỒN KHO)
  const handleAddStockInRecord = async (newStockIn: Omit<StockInRecord, "id" | "createdAt">) => {
    const recordWithId: StockInRecord = {
      ...newStockIn,
      id: "stk_" + Date.now(),
      createdAt: Date.now(),
    };

    if (isFirebaseConfigured() && db) {
      try {
        const newDocRef = doc(collection(db, "stock_in_records"));
        recordWithId.id = newDocRef.id;
        setDoc(newDocRef, sanitizeForFirestore(recordWithId)).catch((err) => {
          console.warn("Lỗi lưu stock_in Firebase:", err);
        });
      } catch (fbErr) {
        console.warn("Lỗi docRef stock_in:", fbErr);
      }
    }

    setStockInRecords((prev) => [recordWithId, ...prev]);
    try {
      const saved = localStorage.getItem("ban_le_stock_in_records");
      const list = saved ? JSON.parse(saved) : [];
      localStorage.setItem("ban_le_stock_in_records", JSON.stringify([recordWithId, ...list]));
    } catch (e) {}

    // Tự động cộng số lượng bao vào tồn kho của sản phẩm
    const targetProd = products.find(
      (p) => p.id === newStockIn.productId || p.name === newStockIn.itemName
    );
    if (targetProd) {
      const cur25 = Number(targetProd.stock25kg) || 0;
      const cur50 = Number(targetProd.stock50kg) || 0;
      const new25 = newStockIn.bagType === "25kg" ? cur25 + newStockIn.quantity : cur25;
      const new50 = newStockIn.bagType === "50kg" ? cur50 + newStockIn.quantity : cur50;
      await handleUpdateProductStock(targetProd.id, new25, new50, targetProd.minStockAlert);
    }
  };

  // 5. HỦY / XÓA PHIẾU NHẬP HÀNG (HOÀN TRẢ TỒN KHO)
  const handleDeleteStockInRecord = async (id: string, reason: string) => {
    const targetRecord = stockInRecords.find((r) => r.id === id);
    if (!targetRecord) return;

    const updatedList = stockInRecords.map((r) =>
      r.id === id ? { ...r, isDeleted: true, deleteReason: reason, deletedAt: Date.now() } : r
    );
    setStockInRecords(updatedList);
    try {
      localStorage.setItem("ban_le_stock_in_records", JSON.stringify(updatedList));
    } catch (e) {}

    if (isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, "stock_in_records", id), sanitizeForFirestore({
          isDeleted: true,
          deleteReason: reason,
          deletedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Lỗi update stock_in Firebase:", err);
      }
    }

    // Trừ ngược lại số lượng tồn kho đã cộng
    const targetProd = products.find(
      (p) => p.id === targetRecord.productId || p.name === targetRecord.itemName
    );
    if (targetProd) {
      const cur25 = Number(targetProd.stock25kg) || 0;
      const cur50 = Number(targetProd.stock50kg) || 0;
      const new25 = targetRecord.bagType === "25kg" ? Math.max(0, cur25 - targetRecord.quantity) : cur25;
      const new50 = targetRecord.bagType === "50kg" ? Math.max(0, cur50 - targetRecord.quantity) : cur50;
      await handleUpdateProductStock(targetProd.id, new25, new50, targetProd.minStockAlert);
    }
  };

  // 6. THÊM GIAO DỊCH BÁN MỚI
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

      // Tự động trừ tồn kho khi bán hàng:
      // - Nếu đơn lấy nhiều lần: chỉ trừ số lượng thực lấy ngay lúc tạo đơn (pickedQuantity)
      // - Nếu đơn thường: trừ toàn bộ số lượng (quantity)
      const soldProd = products.find((p) => p.name === newRecord.itemName);
      if (soldProd) {
        const deductQty = newRecord.isPartialPickup
          ? Math.max(0, Number(newRecord.pickedQuantity) || 0)
          : newRecord.quantity;

        if (deductQty > 0) {
          const cur25 = Number(soldProd.stock25kg) || 0;
          const cur50 = Number(soldProd.stock50kg) || 0;
          const new25 = newRecord.bagType === "25kg" ? Math.max(0, cur25 - deductQty) : cur25;
          const new50 = newRecord.bagType === "50kg" ? Math.max(0, cur50 - deductQty) : cur50;
          handleUpdateProductStock(soldProd.id, new25, new50, soldProd.minStockAlert);
        }
      }
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

  // 6b. THÊM NHIỀU GIAO DỊCH BÁN CÙNG LÚC (BÁN NHIỀU LOẠI)
  const handleAddMultipleRecords = async (recordsList: Omit<SaleRecord, "id" | "createdAt">[]) => {
    if (!recordsList || recordsList.length === 0) return;
    setLoading(true);

    const now = Date.now();
    const createdRecords: SaleRecord[] = recordsList.map((item, idx) => ({
      ...item,
      id: "rec_" + (now + idx),
      createdAt: now + idx,
    }));

    try {
      if (isFirebaseConfigured() && db) {
        createdRecords.forEach((rec) => {
          try {
            const newDocRef = doc(collection(db, "sales"));
            rec.id = newDocRef.id;
            setDoc(newDocRef, sanitizeForFirestore(rec)).catch((err) => {
              console.warn("Lỗi đồng bộ Firebase:", err);
            });
          } catch (fbErr) {
            console.warn("Lỗi khởi tạo docRef Firestore:", fbErr);
          }
        });
      }

      const targetDate = recordsList[0].date;
      setDateRecordsMap((prev) => {
        const currentList = prev[targetDate] || [];
        return {
          ...prev,
          [targetDate]: [...createdRecords, ...currentList],
        };
      });

      const partialsToAdd = createdRecords.filter((r) => r.isPartialPickup);
      if (partialsToAdd.length > 0) {
        setPartialRecords((prev) => [...partialsToAdd, ...prev]);
      }

      // Lưu LocalStorage
      try {
        const saved = localStorage.getItem("ban_le_records");
        const list: SaleRecord[] = saved ? JSON.parse(saved) : [];
        const combined = [...createdRecords, ...list.filter((r) => !createdRecords.some((cr) => cr.id === r.id))];
        localStorage.setItem("ban_le_records", JSON.stringify(combined));
      } catch (e) {}

      setSelectedDate(targetDate);

      // Tự động trừ tồn kho từng mặt hàng
      recordsList.forEach((newRecord) => {
        const soldProd = products.find((p) => p.name === newRecord.itemName);
        if (soldProd) {
          const deductQty = newRecord.isPartialPickup
            ? Math.max(0, Number(newRecord.pickedQuantity) || 0)
            : newRecord.quantity;

          if (deductQty > 0) {
            const cur25 = Number(soldProd.stock25kg) || 0;
            const cur50 = Number(soldProd.stock50kg) || 0;
            const new25 = newRecord.bagType === "25kg" ? Math.max(0, cur25 - deductQty) : cur25;
            const new50 = newRecord.bagType === "50kg" ? Math.max(0, cur50 - deductQty) : cur50;
            handleUpdateProductStock(soldProd.id, new25, new50, soldProd.minStockAlert);
          }
        }
      });
    } catch (err: any) {
      console.warn("Lỗi lưu nhiều đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  // 7. XỬ LÝ LẤY HÀNG NHIỀU LẦN (TỰ ĐỘNG TRỪ TỒN KHO THEO SỐ LƯỢNG LẤY THỰC TẾ)
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
    const foundRecord = partialRecords.find((r) => r.id === recordId);

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

    // Tự động trừ tồn kho theo số lượng lấy lần này trong thẻ Lấy Nhiều Lần
    if (foundRecord && pickupQuantity > 0) {
      const soldProd = products.find((p) => p.name === foundRecord.itemName);
      if (soldProd) {
        const cur25 = Number(soldProd.stock25kg) || 0;
        const cur50 = Number(soldProd.stock50kg) || 0;
        const new25 = foundRecord.bagType === "25kg" ? Math.max(0, cur25 - pickupQuantity) : cur25;
        const new50 = foundRecord.bagType === "50kg" ? Math.max(0, cur50 - pickupQuantity) : cur50;
        handleUpdateProductStock(soldProd.id, new25, new50, soldProd.minStockAlert);
      }
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

  // 8. XÓA GIAO DỊCH KÈM LÝ DO (Soft Delete) & HOÀN TRẢ TỒN KHO
  const handleDeleteRecord = async (id: string, reason: string) => {
    const targetDate = selectedDate;
    const currentList = dateRecordsMap[targetDate] || [];
    const targetRecord = currentList.find((r) => r.id === id);

    setDateRecordsMap((prev) => {
      const list = prev[targetDate] || [];
      const updated = list.map((r) => {
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

    // Hoàn trả lại số lượng tồn kho thực tế đã trừ khi xóa đơn bán
    if (targetRecord && !targetRecord.isDeleted) {
      const soldProd = products.find((p) => p.name === targetRecord.itemName);
      if (soldProd) {
        const refundQty = targetRecord.isPartialPickup
          ? Math.max(0, Number(targetRecord.pickedQuantity) || 0)
          : targetRecord.quantity;

        if (refundQty > 0) {
          const cur25 = Number(soldProd.stock25kg) || 0;
          const cur50 = Number(soldProd.stock50kg) || 0;
          const new25 = targetRecord.bagType === "25kg" ? cur25 + refundQty : cur25;
          const new50 = targetRecord.bagType === "50kg" ? cur50 + refundQty : cur50;
          handleUpdateProductStock(soldProd.id, new25, new50, soldProd.minStockAlert);
        }
      }
    }

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

  // 9. TẢI DỮ LIỆU ĐỂ XUẤT EXCEL
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

  const isRecordInSalesBook = (r: SaleRecord) => {
    if (!r.isPartialPickup) return true;
    return r.pickupStatus === "completed";
  };

  // Thống kê hôm nay
  const todayRecords = (dateRecordsMap[today] || []).filter(isRecordInSalesBook);
  const todayActiveRecords = todayRecords.filter((r) => !r.isDeleted);
  const todayRevenue = todayActiveRecords.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  const todayBao25 = todayActiveRecords
    .filter((r) => r.bagType === "25kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const todayBao50 = todayActiveRecords
    .filter((r) => r.bagType === "50kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Đếm số đơn đang gửi kho
  const pendingPickupsCount = partialRecords.filter(
    (r) => r.isPartialPickup && r.pickupStatus !== "completed" && !r.isDeleted
  ).length;

  // Đếm số mặt hàng sắp hết trong kho
  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const s25 = Number(p.stock25kg) || 0;
      const s50 = Number(p.stock50kg) || 0;
      const min = p.minStockAlert !== undefined ? p.minStockAlert : 5;
      return (s25 + s50) <= min;
    }).length;
  }, [products]);

  const currentViewRecords = (dateRecordsMap[selectedDate] || []).filter(isRecordInSalesBook);
  const formatVND = (num: number) => formatCurrencyVND(num);



  if (!isUnlocked) {
    return <PinLockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  const renderTabs = (isCompact: boolean) => (
    <div className={`grid grid-cols-3 gap-1 bg-slate-200/90 rounded-xl shadow-2xs font-bold ${isCompact ? 'p-0.5 text-[10px] sm:text-[11px]' : 'p-1 text-[11px]'}`}>
      <button
        type="button"
        onClick={() => setActiveTab("form")}
        className={`py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
          activeTab === "form"
            ? "bg-white text-green-700 shadow-xs scale-[1.01]"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <PlusCircle className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span className="truncate">{isCompact ? "Bán" : "Nhập Bán"}</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab("pickups")}
        className={`py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
          activeTab === "pickups"
            ? "bg-white text-teal-700 shadow-xs scale-[1.01]"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Layers className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span className="truncate">
          {isCompact ? `Gửi (${pendingPickupsCount})` : `Gửi Lại (${pendingPickupsCount})`}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab("table")}
        className={`py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
          activeTab === "table"
            ? "bg-white text-emerald-700 shadow-xs scale-[1.01]"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <ClipboardList className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span className="truncate">{isCompact ? `Sổ (${todayActiveRecords.length})` : `Sổ Đơn (${todayActiveRecords.length})`}</span>
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100/70 pb-10 sm:pb-8 text-slate-800">
      {/* Header Sticky Sáng Cực Gọn */}
      <header className={`bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs transition-all duration-300 py-1`}>
        <div className={`max-w-2xl mx-auto px-2 sm:px-4 flex items-center justify-between transition-all duration-300 h-10 sm:h-12`}>
          <div className="flex items-center gap-2">
            <div className={`rounded-lg bg-green-600 flex items-center justify-center text-white shadow-2xs transition-all ${isHeaderExpanded ? 'w-7 h-7' : 'w-5 h-5'}`}>
              <Store className={isHeaderExpanded ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />
            </div>
            <div>
              <h1 className={`${isHeaderExpanded ? 'text-xs sm:text-sm' : 'text-[10px]'} font-black tracking-tight text-slate-800 flex items-center gap-1 transition-all`}>
                SỔ BÁN LẺ
                <span
                  className={`uppercase font-bold px-1 py-0.2 rounded transition-all ${
                    isHeaderExpanded ? 'text-[9px]' : 'text-[7px]'
                  } ${
                    isFirebaseConnected
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isFirebaseConnected ? "ONLINE" : "LOCAL"}
                </span>
              </h1>
              {isHeaderExpanded && (
                <p className="text-[9px] text-slate-400">
                  {getVietnamTodayDisplay()} • Giờ VN (GMT+7)
                </p>
              )}
            </div>
          </div>

          {!isHeaderExpanded && (
            <div className="flex-1 px-1 sm:px-2 flex justify-center max-w-[320px]">
              {renderTabs(true)}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {isHeaderExpanded && (
              <>
                {/* Chọn Người Bán */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
                    className="flex items-center gap-1 px-2 py-1.5 bg-pink-50 hover:bg-pink-100 active:scale-95 text-pink-700 text-[10px] sm:text-[11px] font-bold rounded-xl border border-pink-200 transition"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{sellerName}</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </button>
                  
                  {isSellerDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSellerDropdownOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-1.5 w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 overflow-hidden">
                        {["Hằng", "Gấm", "Duyên"].map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSellerName(name);
                              setIsSellerDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center justify-between hover:bg-slate-50 transition ${sellerName === name ? 'text-pink-600 bg-pink-50/50' : 'text-slate-600'}`}
                          >
                            {name}
                            {sellerName === name && <CheckCircle2 className="w-3 h-3 text-pink-600" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-2xs transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xuất Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleLockApp}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 rounded-xl transition"
                  title="Khóa ứng dụng"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-500 rounded-xl transition ml-1"
            >
              {isHeaderExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* THANH CHỌN THẺ NẰM TRONG HEADER (NẾU MỞ RỘNG) */}
        {isHeaderExpanded && (
          <div className="max-w-2xl mx-auto px-2 sm:px-4 pb-1 mt-1 animate-fadeIn">
            {renderTabs(false)}
          </div>
        )}
      </header>
      
      <InstallBanner />

      {/* Main Container: 2 Cột trên PC */}
      <div className="max-w-7xl mx-auto px-1.5 sm:px-4 pt-1.5 lg:flex lg:gap-4 lg:items-start">
        {/* CỘT TRÁI: SỔ BÁN LẺ */}
        <div className="w-full lg:flex-1 lg:max-w-2xl mx-auto space-y-1.5">
        {/* NỘI DUNG THẺ */}
        {activeTab === "form" ? (
          <div className="space-y-2.5">
            {/* Form Tạo Đơn */}
            <SalesForm 
              onAddRecord={handleAddRecord} 
              seller={sellerName}
              loading={loading} 
            />

            {/* Nút Nhỏ Quản Lý & Nhập Tồn Kho Nằm Dưới Bảng Tạo Đơn (CHỈ HIỆN TRÊN MOBILE) */}
            <div className="lg:hidden bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Quản Lý & Nhập Tồn Kho</span>
                    {lowStockCount > 0 && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {lowStockCount} hàng sắp hết
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Kiểm kê số bao, tạo phiếu nhập hàng mới</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-2xs transition shrink-0"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Xem Tồn Kho</span>
              </button>
            </div>
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
              stockInRecords={stockInRecords}
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
              products={products}
              onAddPickup={handleAddPickup}
              onDeleteRecord={handleDeleteRecord}
            />
          </div>
        )}
        </div>

        {/* CỘT PHẢI: QUẢN LÝ TỒN KHO (CHỈ HIỆN TRÊN PC) */}
        <div className="hidden lg:block lg:w-[450px] xl:w-[500px] shrink-0 sticky top-16">
          {/* Banner Tồn Kho trên PC */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-800">Quản Lý & Nhập Tồn Kho</span>
                  {lowStockCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-pulse">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {lowStockCount} sắp hết
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Kiểm kê lượng bao và tạo phiếu nhập</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsInventoryModalOpen(!isInventoryModalOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-2xs transition shrink-0"
            >
              {isInventoryModalOpen ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Thu Gọn</span>
                </>
              ) : (
                <>
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Xem Tồn Kho</span>
                </>
              )}
            </button>
          </div>

          {/* Accordion Mở Rộng Tồn Kho trên PC */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isInventoryModalOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="bg-slate-100/80 rounded-3xl p-4 border border-slate-200 shadow-xl overflow-y-auto max-h-[85vh]">
              <InventoryTab onResetAllStock={handleResetAllStock}
                products={products}
                stockInRecords={stockInRecords}
                onUpdateProductStock={handleUpdateProductStock}
                onUpdateProductFull={handleUpdateProductFull}
                onDeleteProduct={handleDeleteProduct}
                onAddStockInRecord={handleAddStockInRecord}
                onDeleteStockInRecord={handleDeleteStockInRecord}
                onAddNewProduct={handleAddNewProduct}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL QUẢN LÝ & NHẬP TỒN KHO (CHỈ HIỆN TRÊN MOBILE) */}
      {isInventoryModalOpen && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-100 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            {/* Header Modal */}
            <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-800">
                    QUẢN LÝ & NHẬP LƯỢNG TỒN KHO
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Kiểm kê lượng bao và theo dõi lịch sử nhập hàng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nội dung Tồn Kho cuộn được */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2">
              <InventoryTab onResetAllStock={handleResetAllStock}
                products={products}
                stockInRecords={stockInRecords}
                onUpdateProductStock={handleUpdateProductStock}
                onUpdateProductFull={handleUpdateProductFull}
                onDeleteProduct={handleDeleteProduct}
                onAddStockInRecord={handleAddStockInRecord}
                onDeleteStockInRecord={handleDeleteStockInRecord}
                onAddNewProduct={handleAddNewProduct}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Xuất Báo Cáo Excel */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        stockInRecords={stockInRecords}
        onFetchRecords={handleFetchExportRecords}
      />
    </main>
  );
}
