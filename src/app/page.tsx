"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SaleRecord, PickupEvent, ProductItem, StockInRecord } from "@/types";
import SalesForm from "@/components/SalesForm";
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
  { id: "p1", name: "CÃ¡m lá»£n (heo)", price: 380000, allow25kg: true, allow50kg: true, stock25kg: 25, stock50kg: 40, minStockAlert: 5 },
  { id: "p2", name: "CÃ¡m gÃ  / vá»t", price: 350000, allow25kg: true, allow50kg: true, stock25kg: 18, stock50kg: 32, minStockAlert: 5 },
  { id: "p3", name: "CÃ¡m bÃ² / dÃª", price: 290000, allow25kg: true, allow50kg: true, stock25kg: 10, stock50kg: 20, minStockAlert: 5 },
  { id: "p4", name: "Gáº¡o ST25", price: 420000, allow25kg: true, allow50kg: true, stock25kg: 30, stock50kg: 50, minStockAlert: 5 },
  { id: "p5", name: "Gáº¡o ÄÃ i ThÆ¡m", price: 360000, allow25kg: true, allow50kg: true, stock25kg: 20, stock50kg: 35, minStockAlert: 5 },
  { id: "p6", name: "Gáº¡o Báº¯c HÆ°Æ¡ng", price: 340000, allow25kg: true, allow50kg: true, stock25kg: 15, stock50kg: 25, minStockAlert: 5 },
  { id: "p7", name: "PhÃ¢n bÃ³n NPK", price: 450000, allow25kg: true, allow50kg: true, stock25kg: 12, stock50kg: 28, minStockAlert: 5 },
  { id: "p8", name: "Äáº¡m Ure", price: 390000, allow25kg: true, allow50kg: true, stock25kg: 14, stock50kg: 22, minStockAlert: 5 },
  { id: "p9", name: "PhÃ¢n LÃ¢n / Kali", price: 310000, allow25kg: true, allow50kg: true, stock25kg: 8, stock50kg: 18, minStockAlert: 5 },
  { id: "p10", name: "NgÃ´ háº¡t / Bá»t ngÃ´", price: 280000, allow25kg: true, allow50kg: true, stock25kg: 16, stock50kg: 30, minStockAlert: 5 },
  { id: "p11", name: "ÄÆ°á»ng cÃ¡t tráº¯ng", price: 520000, allow25kg: true, allow50kg: true, stock25kg: 10, stock50kg: 15, minStockAlert: 5 },
];

export default function HomePage() {
  const today = getVietnamDate();

  // MÃ£ PIN báº£o vá» (1977)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Tráº¡ng thÃ¡i ngÆ°á»i bÃ¡n vÃ  header
  const [sellerName, setSellerName] = useState<string>("Háº±ng");
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

  // Danh má»¥c hÃ ng & Tá»n kho
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  // Danh sÃ¡ch phiáº¿u nháº­p hÃ ng
  const [stockInRecords, setStockInRecords] = useState<StockInRecord[]>([]);

  // Bá» nhá» Äá»m lÆ°u ÄÆ¡n hÃ ng theo tá»«ng ngÃ y: Record<"YYYY-MM-DD", SaleRecord[]>
  const [dateRecordsMap, setDateRecordsMap] = useState<Record<string, SaleRecord[]>>({});
  // Danh sÃ¡ch cÃ¡c ÄÆ¡n láº¥y nhiá»u láº§n (Äang lÆ°u giá»¯ / gá»­i kho)
  const [partialRecords, setPartialRecords] = useState<SaleRecord[]>([]);
  // Danh sÃ¡ch cÃ¡c ngÃ y ÄÃ£ táº£i tá»« Firestore Äá» trÃ¡nh Äá»c láº¡i
  const [loadedDates, setLoadedDates] = useState<Set<string>>(new Set());

  // 1. Láº®NG NGHE ÄÆ N HÃNG HÃM NAY, ÄÆ N Gá»¬I KHO, DANH Má»¤C HÃNG & PHIáº¾U NHáº¬P KHO
  useEffect(() => {
    let unsubscribeToday = () => {};
    let unsubscribePartials = () => {};
    let unsubscribeProducts = () => {};
    let unsubscribeStockIn = () => {};

    if (isFirebaseConfigured() && db) {
      try {
        // A. Láº¯ng nghe ÄÆ¡n hÃ´m nay
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

        // B. Láº¯ng nghe cÃ¡c ÄÆ¡n láº¥y nhiá»u láº§n
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

        // C. Láº¯ng nghe danh má»¥c hÃ ng & sá» lÆ°á»£ng tá»n kho
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

        // D. Láº¯ng nghe danh sÃ¡ch phiáº¿u nháº­p kho
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
      // 1. ÄÆ¡n bÃ¡n
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
          console.error("Lá»i Äá»c localStorage sales:", e);
        }
      }

      // 2. Danh má»¥c sáº£n pháº©m & tá»n kho
      const savedProducts = localStorage.getItem("ban_le_products");
      if (savedProducts) {
        try {
          const parsed = JSON.parse(savedProducts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
          }
        } catch (e) {}
      }

      // 3. Phiáº¿u nháº­p kho
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

  // 2. Táº¢I THEO YÃU Cáº¦U KHI CHá»N NGÃY CÅ¨ (On-Demand Loading)
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
          console.warn(`Lá»i táº£i dá»¯ liá»u ngÃ y ${dateToLoad}:`, err);
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

  // 3. Cáº¬P NHáº¬T Tá»N KHO Máº¶T HÃNG (KIá»M KÃ)
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
        console.warn("Lá»i lÆ°u tá»n kho lÃªn Firebase:", err);
      }
    }
  };

  // 3.1. THÃM Máº¶T HÃNG Má»I KÃM Sá» LÆ¯á»¢NG Tá»N BAN Äáº¦U

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
        console.warn("Lá»i lÆ°u sáº£n pháº©m má»i Firebase:", err);
      }
    }
    return newItem;
  };

  // 3.2. Cáº¬P NHáº¬T Äáº¦Y Äá»¦ THÃNG TIN Máº¶T HÃNG (TÃN, GIÃ, LOáº I BAO, Tá»N KHO)
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
        console.warn("Lá»i lÆ°u sáº£n pháº©m lÃªn Firebase:", err);
      }
    }
  };

  // 3.3. XÃA Máº¶T HÃNG KHá»I DANH Má»¤C
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
        console.warn("Lá»i xÃ³a sáº£n pháº©m Firebase:", err);
      }
    }
  };

  // 4. Táº O PHIáº¾U NHáº¬P HÃNG Má»I (Tá»° Äá»NG TÄNG Tá»N KHO)
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
          console.warn("Lá»i lÆ°u stock_in Firebase:", err);
        });
      } catch (fbErr) {
        console.warn("Lá»i docRef stock_in:", fbErr);
      }
    }

    setStockInRecords((prev) => [recordWithId, ...prev]);
    try {
      const saved = localStorage.getItem("ban_le_stock_in_records");
      const list = saved ? JSON.parse(saved) : [];
      localStorage.setItem("ban_le_stock_in_records", JSON.stringify([recordWithId, ...list]));
    } catch (e) {}

    // Tá»± Äá»ng cá»ng sá» lÆ°á»£ng bao vÃ o tá»n kho cá»§a sáº£n pháº©m
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

  // 5. Há»¦Y / XÃA PHIáº¾U NHáº¬P HÃNG (HOÃN TRáº¢ Tá»N KHO)
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
        console.warn("Lá»i update stock_in Firebase:", err);
      }
    }

    // Trá»« ngÆ°á»£c láº¡i sá» lÆ°á»£ng tá»n kho ÄÃ£ cá»ng
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

  // 6. THÃM GIAO Dá»CH BÃN Má»I
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
            console.warn("Lá»i Äá»ng bá» Firebase:", err);
          });
        } catch (fbErr) {
          console.warn("Lá»i khá»i táº¡o docRef Firestore:", fbErr);
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

      // Tá»± Äá»ng trá»« tá»n kho khi bÃ¡n hÃ ng:
      // - Náº¿u ÄÆ¡n láº¥y nhiá»u láº§n: chá» trá»« sá» lÆ°á»£ng thá»±c láº¥y ngay lÃºc táº¡o ÄÆ¡n (pickedQuantity)
      // - Náº¿u ÄÆ¡n thÆ°á»ng: trá»« toÃ n bá» sá» lÆ°á»£ng (quantity)
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
      console.warn("Lá»i lÆ°u ÄÆ¡n hÃ ng:", err);
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

  // 6b. THÃM NHIá»U GIAO Dá»CH BÃN CÃNG LÃC (BÃN NHIá»U LOáº I)
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
              console.warn("Lá»i Äá»ng bá» Firebase:", err);
            });
          } catch (fbErr) {
            console.warn("Lá»i khá»i táº¡o docRef Firestore:", fbErr);
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

      // LÆ°u LocalStorage
      try {
        const saved = localStorage.getItem("ban_le_records");
        const list: SaleRecord[] = saved ? JSON.parse(saved) : [];
        const combined = [...createdRecords, ...list.filter((r) => !createdRecords.some((cr) => cr.id === r.id))];
        localStorage.setItem("ban_le_records", JSON.stringify(combined));
      } catch (e) {}

      setSelectedDate(targetDate);

      // Tá»± Äá»ng trá»« tá»n kho tá»«ng máº·t hÃ ng
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
      console.warn("Lá»i lÆ°u nhiá»u ÄÆ¡n hÃ ng:", err);
    } finally {
      setLoading(false);
    }
  };

  // 7. Xá»¬ LÃ Láº¤Y HÃNG NHIá»U Láº¦N (Tá»° Äá»NG TRá»ª Tá»N KHO THEO Sá» LÆ¯á»¢NG Láº¤Y THá»°C Táº¾)
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

    // Tá»± Äá»ng trá»« tá»n kho theo sá» lÆ°á»£ng láº¥y láº§n nÃ y trong tháº» Láº¥y Nhiá»u Láº§n
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

    // Cáº­p nháº­t Firebase
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
        console.warn("Lá»i cáº­p nháº­t pickup Firestore:", err);
      }
    }
  };

  // 8. XÃA GIAO Dá»CH KÃM LÃ DO (Soft Delete) & HOÃN TRáº¢ Tá»N KHO
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

    // HoÃ n tráº£ láº¡i sá» lÆ°á»£ng tá»n kho thá»±c táº¿ ÄÃ£ trá»« khi xÃ³a ÄÆ¡n bÃ¡n
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
        console.warn("Lá»i update Firebase:", err);
      }
    }
  };

  // 9. Táº¢I Dá»® LIá»U Äá» XUáº¤T EXCEL
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
          console.warn("Lá»i fetch export:", err);
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

  // Thá»ng kÃª hÃ´m nay
  const todayRecords = (dateRecordsMap[today] || []).filter(isRecordInSalesBook);
  const todayActiveRecords = todayRecords.filter((r) => !r.isDeleted);
  const todayRevenue = todayActiveRecords.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
  const todayBao25 = todayActiveRecords
    .filter((r) => r.bagType === "25kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const todayBao50 = todayActiveRecords
    .filter((r) => r.bagType === "50kg")
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Äáº¿m sá» ÄÆ¡n Äang gá»­i kho
  const pendingPickupsCount = partialRecords.filter(
    (r) => r.isPartialPickup && r.pickupStatus !== "completed" && !r.isDeleted
  ).length;

  // Äáº¿m sá» máº·t hÃ ng sáº¯p háº¿t trong kho
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
        <span className="truncate">{isCompact ? "BÃ¡n" : "Nháº­p BÃ¡n"}</span>
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
          {isCompact ? `Gá»­i (${pendingPickupsCount})` : `Gá»­i Láº¡i (${pendingPickupsCount})`}
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
        <span className="truncate">{isCompact ? `Sá» (${todayActiveRecords.length})` : `Sá» ÄÆ¡n (${todayActiveRecords.length})`}</span>
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100/70 pb-10 sm:pb-8 text-slate-800">
      {/* Header Sticky SÃ¡ng Cá»±c Gá»n */}
      <header className={`bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs transition-all duration-300 py-1`}>
        <div className={`max-w-2xl mx-auto px-2 sm:px-4 flex items-center justify-between transition-all duration-300 h-10 sm:h-12`}>
          <div className="flex items-center gap-2">
            <div className={`rounded-lg bg-green-600 flex items-center justify-center text-white shadow-2xs transition-all ${isHeaderExpanded ? 'w-7 h-7' : 'w-5 h-5'}`}>
              <Store className={isHeaderExpanded ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />
            </div>
            <div>
              <h1 className={`${isHeaderExpanded ? 'text-xs sm:text-sm' : 'text-[10px]'} font-black tracking-tight text-slate-800 flex items-center gap-1 transition-all`}>
                Sá» BÃN Láºº
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
                  {getVietnamTodayDisplay()} â¢ Giá» VN (GMT+7)
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
                {/* Chá»n NgÆ°á»i BÃ¡n */}
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
                        {["Háº±ng", "Gáº¥m", "DuyÃªn"].map((name) => (
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
                  <span className="hidden sm:inline">Xuáº¥t Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleLockApp}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 rounded-xl transition"
                  title="KhÃ³a á»©ng dá»¥ng"
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

        {/* THANH CHá»N THáºº Náº°M TRONG HEADER (Náº¾U Má» Rá»NG) */}
        {isHeaderExpanded && (
          <div className="max-w-2xl mx-auto px-2 sm:px-4 pb-1 mt-1 animate-fadeIn">
            {renderTabs(false)}
          </div>
        )}
      </header>

      {/* Main Container: 2 Cá»t trÃªn PC */}
      <div className="max-w-7xl mx-auto px-1.5 sm:px-4 pt-1.5 lg:flex lg:gap-4 lg:items-start">
        {/* Cá»T TRÃI: Sá» BÃN Láºº */}
        <div className="w-full lg:flex-1 lg:max-w-2xl mx-auto space-y-1.5">
        {/* Ná»I DUNG THáºº */}
        {activeTab === "form" ? (
          <div className="space-y-2.5">
            {/* Form Táº¡o ÄÆ¡n */}
            <SalesForm 
              onAddRecord={handleAddRecord} 
              seller={sellerName}
              loading={loading} 
            />

            {/* NÃºt Nhá» Quáº£n LÃ½ & Nháº­p Tá»n Kho Náº±m DÆ°á»i Báº£ng Táº¡o ÄÆ¡n (CHá» HIá»N TRÃN MOBILE) */}
            <div className="lg:hidden bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Quáº£n LÃ½ & Nháº­p Tá»n Kho</span>
                    {lowStockCount > 0 && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {lowStockCount} hÃ ng sáº¯p háº¿t
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Kiá»m kÃª sá» bao, táº¡o phiáº¿u nháº­p hÃ ng má»i</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-2xs transition shrink-0"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Xem Tá»n Kho</span>
              </button>
            </div>
          </div>
        ) : activeTab === "table" ? (
          <div className="space-y-2.5">
            {/* Banner TÃ³m Táº¯t Doanh Sá» HÃ´m Nay */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-3 text-white shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/15 rounded-lg">
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-200 font-medium">
                    HÃ´m nay ({todayActiveRecords.length} ÄÆ¡n):
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

            {/* Báº£ng sá» ÄÆ¡n hÃ ng */}
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
            {/* Tháº» Quáº£n LÃ½ CÃ¡c ÄÆ¡n KhÃ¡ch Láº¥y Nhiá»u Láº§n */}
            <PartialPickupsTab
              records={partialRecords}
              products={products}
              onAddPickup={handleAddPickup}
              onDeleteRecord={handleDeleteRecord}
            />
          </div>
        )}
        </div>

        {/* Cá»T PHáº¢I: QUáº¢N LÃ Tá»N KHO (CHá» HIá»N TRÃN PC) */}
        <div className="hidden lg:block lg:w-[450px] xl:w-[500px] shrink-0 sticky top-16">
          {/* Banner Tá»n Kho trÃªn PC */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-800">Quáº£n LÃ½ & Nháº­p Tá»n Kho</span>
                  {lowStockCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-pulse">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {lowStockCount} sáº¯p háº¿t
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Kiá»m kÃª lÆ°á»£ng bao vÃ  táº¡o phiáº¿u nháº­p</p>
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
                  <span>Thu Gá»n</span>
                </>
              ) : (
                <>
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Xem Tá»n Kho</span>
                </>
              )}
            </button>
          </div>

          {/* Accordion Má» Rá»ng Tá»n Kho trÃªn PC */}
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

      {/* MODAL QUáº¢N LÃ & NHáº¬P Tá»N KHO (CHá» HIá»N TRÃN MOBILE) */}
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
                    QUáº¢N LÃ & NHáº¬P LÆ¯á»¢NG Tá»N KHO
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Kiá»m kÃª lÆ°á»£ng bao vÃ  theo dÃµi lá»ch sá»­ nháº­p hÃ ng
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

            {/* Ná»i dung Tá»n Kho cuá»n ÄÆ°á»£c */}
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

      {/* Modal Xuáº¥t BÃ¡o CÃ¡o Excel */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        stockInRecords={stockInRecords}
        onFetchRecords={handleFetchExportRecords}
      />
    </main>
  );
}


