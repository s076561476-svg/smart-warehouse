import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

// =========================
// 型別定義
// =========================
type Item = {
  id: string;
  name: string | null;
};

type Slot = {
  id: string;
  slot_code: string;
  status?: string | null;
};

type InventoryRow = {
  id: string;
  item_id: string;
  slot_id: string;
  qty: number;
  items?: Item | Item[] | null;
  slots?: Slot | Slot[] | null;
};

type StockLog = {
  id: string;
  qty: number;
  action: string;
  created_at: string;
};

function Dashboard() {
  // =========================
  // KPI 狀態
  // =========================
  const [itemCount, setItemCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [todayIn, setTodayIn] = useState(0);
  const [todayOut, setTodayOut] = useState(0);

  // =========================
  // 基礎資料
  // =========================
  const [items, setItems] = useState<Item[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  // =========================
  // Modal 狀態
  // =========================
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);

  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    loadDashboard();
  }, []);

  // =========================
  // 載入 Dashboard 資料
  // =========================
  async function loadDashboard() {
    try {
      // 1. 商品總數
      const { count: itemTotal, error: itemCountError } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true });

      if (itemCountError) {
        console.error("讀取商品總數失敗：", itemCountError);
      }

      // 2. 庫存筆數
      const { count: inventoryTotal, error: inventoryCountError } =
        await supabase
          .from("inventory")
          .select("*", { count: "exact", head: true });

      if (inventoryCountError) {
        console.error("讀取庫存筆數失敗：", inventoryCountError);
      }

      // 3. 總庫存量
      const { data: inventoryQtyData, error: inventoryQtyError } =
        await supabase.from("inventory").select("qty");

      if (inventoryQtyError) {
        console.error("讀取總庫存量失敗：", inventoryQtyError);
      }

      const qtySum =
        inventoryQtyData?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;

      // 4. 今日日期
      const today = new Date().toISOString().split("T")[0];

      // 5. 異動紀錄
      const { data: logsData, error: logsError } = await supabase
        .from("stock_logs")
        .select("*");

      if (logsError) {
        console.error("讀取異動紀錄失敗：", logsError);
      }

      const logs = (logsData || []) as StockLog[];

      // 今日入庫
      const inQty =
        logs
          .filter(
            (x) =>
              x.action === "STOCK_IN" && x.created_at?.split("T")[0] === today,
          )
          .reduce((sum, x) => sum + x.qty, 0) || 0;

      // 今日出庫
      const outQty =
        logs
          .filter(
            (x) =>
              x.action === "STOCK_OUT" && x.created_at?.split("T")[0] === today,
          )
          .reduce((sum, x) => sum + x.qty, 0) || 0;

      // 6. 商品清單
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, name");

      if (itemError) {
        console.error("讀取商品清單失敗：", itemError);
      }

      // 7. 儲位清單
      const { data: slotData, error: slotError } = await supabase
        .from("slots")
        .select("id, slot_code, status")
        .order("slot_code", { ascending: true });

      if (slotError) {
        console.error("讀取儲位清單失敗：", slotError);
      }

      // 8. 庫存資料（連 items / slots）
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select(
          `
          id,
          item_id,
          slot_id,
          qty,
          items (
            id,
            name
          ),
          slots (
            id,
            slot_code,
            status
          )
        `,
        );

      if (inventoryError) {
        console.error("讀取庫存資料失敗：", inventoryError);
      }

      // 寫入 state
      setItemCount(itemTotal || 0);
      setInventoryCount(inventoryTotal || 0);
      setTotalQty(qtySum);
      setTodayIn(inQty);
      setTodayOut(outQty);

      setItems((itemData as Item[]) || []);
      setSlots((slotData as Slot[]) || []);
      setInventory((inventoryData as InventoryRow[]) || []);
    } catch (error) {
      console.error("Dashboard 載入失敗：", error);
    }
  }

  // =========================
  // 工具：抓商品名稱
  // 優先順序：
  // 1. inventory join 回來的 items.name
  // 2. 用 item_id 去 items state 回查
  // 3. 都沒有才顯示 未命名商品
  // =========================
  function getItemName(row: InventoryRow) {
    // 先看 inventory join 回來的 items
    if (row.items) {
      if (Array.isArray(row.items)) {
        const joinedName = row.items[0]?.name?.trim();
        if (joinedName) return joinedName;
      } else {
        const joinedName = row.items.name?.trim();
        if (joinedName) return joinedName;
      }
    }

    // 再從 items state 依 item_id 回查
    const found = items.find((item) => item.id === row.item_id);
    if (found?.name?.trim()) return found.name.trim();

    return "未命名商品";
  }

  // =========================
  // 取得某儲位的所有庫存
  // =========================
  function getSlotInventory(slotId: string) {
    return inventory.filter((row) => row.slot_id === slotId);
  }

  // =========================
  // 取得某儲位的商品筆數
  // =========================
  function getSlotItemCount(slotId: string) {
    return getSlotInventory(slotId).length;
  }

  // =========================
  // 取得某儲位總數量
  // =========================
  function getSlotTotalQty(slotId: string) {
    return getSlotInventory(slotId).reduce(
      (sum, row) => sum + (row.qty || 0),
      0,
    );
  }

  // =========================
  // 判斷儲位燈號
  // 紅燈：有庫存 / 使用中
  // 黃燈：預計使用 / 預留儲位
  // 綠燈：空位 / 無庫存
  // =========================
  function getSlotStatus(slot: Slot) {
    const slotRows = getSlotInventory(slot.id);

    // 有庫存 => 紅燈
    if (slotRows.length > 0) {
      return {
        label: "使用中",
        color: "#ef4444",
      };
    }

    // 預計使用 / 預留儲位 => 黃燈
    const statusText = slot.status?.toUpperCase() || "";
    if (
      statusText === "RESERVED" ||
      statusText === "PENDING" ||
      statusText === "預計使用"
    ) {
      return {
        label: "預計使用",
        color: "#eab308",
      };
    }

    // 其餘 => 綠燈
    return {
      label: "空儲位",
      color: "#22c55e",
    };
  }

  // =========================
  // 開啟儲位明細 Modal
  // =========================
  function openSlotModal(slot: Slot) {
    setSelectedSlot(slot);
    setShowSlotModal(true);
  }

  // =========================
  // Modal 用資料
  // =========================
  const selectedSlotInventory = selectedSlot
    ? getSlotInventory(selectedSlot.id)
    : [];

  const selectedSlotTotalQty = selectedSlot
    ? getSlotTotalQty(selectedSlot.id)
    : 0;

  const selectedSlotItemCount = selectedSlot
    ? getSlotItemCount(selectedSlot.id)
    : 0;

  return (
    <div style={{ padding: "20px" }}>
      {/* =========================
          標題
      ========================= */}
      <h1
        style={{
          fontSize: isMobile ? "28px" : "42px",
          textAlign: "center",
          marginBottom: "24px",
          lineHeight: "1.2",
        }}
      >
        智慧倉儲管理儀表板
      </h1>

      {/* =========================
          KPI 卡片
      ========================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        <div
          style={{
            border: "2px solid red",
            padding: "20px",
            borderRadius: "16px",
            backgroundColor: "#fff5f5",
            textAlign: "center",
          }}
        >
          <h2>今日入庫</h2>
          <h1>{todayIn}</h1>
        </div>

        <div
          style={{
            border: "2px solid #ef4444",
            padding: "20px",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <h2>今日出庫</h2>
          <h1>{todayOut}</h1>
        </div>

        <div
          style={{
            border: "2px solid #2563eb",
            padding: "20px",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <h2>商品總數</h2>
          <h1>{itemCount}</h1>
        </div>

        <div
          style={{
            border: "2px solid #16a34a",
            padding: "20px",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <h2>庫存筆數</h2>
          <h1>{inventoryCount}</h1>
        </div>

        <div
          style={{
            border: "2px solid #f59e0b",
            padding: "20px",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <h2>總庫存量</h2>
          <h1>{totalQty}</h1>
        </div>
      </div>

      {/* =========================
          儲位概況標題
      ========================= */}
      <h2 style={{ marginTop: "50px", textAlign: "center" }}>儲位概況</h2>

      {/* =========================
          燈號圖例
      ========================= */}
      <div
        style={{
          marginTop: "20px",
          marginBottom: "24px",
          background: "#fff",
          borderRadius: "16px",
          padding: "18px 20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "center",
          justifyContent: isMobile ? "flex-start" : "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#ef4444",
              display: "inline-block",
            }}
          />
          <span>紅燈：使用中 / 有庫存</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#eab308",
              display: "inline-block",
            }}
          />
          <span>黃燈：預計使用 / 預留儲位</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#22c55e",
              display: "inline-block",
            }}
          />
          <span>綠燈：空位 / 無庫存</span>
        </div>
      </div>

      {/* =========================
          儲位卡片區
      ========================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: "18px",
          marginTop: "20px",
        }}
      >
        {slots.map((slot) => {
          const slotStatus = getSlotStatus(slot);
          const slotItemCount = getSlotItemCount(slot.id);
          const slotTotalQty = getSlotTotalQty(slot.id);

          return (
            <div
              key={slot.id}
              onClick={() => openSlotModal(slot)}
              style={{
                position: "relative",
                border: "1px solid #d1d5db",
                borderRadius: "18px",
                padding: "24px 18px",
                background: "#fff",
                cursor: "pointer",
                minHeight: "170px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                transition: "0.2s",
              }}
            >
              {/* 左上角燈號 */}
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  left: "14px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: slotStatus.color,
                  boxShadow: `0 0 12px ${slotStatus.color}`,
                }}
              />

              {/* 儲位編號 */}
              <h3
                style={{
                  textAlign: "center",
                  fontSize: "28px",
                  margin: "8px 0 14px 0",
                  color: "#6b6885",
                }}
              >
                {slot.slot_code}
              </h3>

              {/* 狀態 */}
              <p
                style={{
                  textAlign: "center",
                  fontSize: "18px",
                  color: "#64748b",
                  marginBottom: "18px",
                }}
              >
                {slotStatus.label}
              </p>

              {/* 有庫存時顯示筆數與總數量 */}
              {slotItemCount > 0 ? (
                <>
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: "18px",
                      margin: "6px 0",
                      color: "#475569",
                    }}
                  >
                    商品筆數：{slotItemCount}
                  </p>
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: "18px",
                      margin: "6px 0",
                      color: "#475569",
                    }}
                  >
                    總數量：{slotTotalQty}
                  </p>
                </>
              ) : (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "18px",
                    color: "#94a3b8",
                    marginTop: "20px",
                  }}
                >
                  目前無庫存
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================
          儲位明細 Modal
      ========================= */}
      {showSlotModal && selectedSlot && (
        <div
          onClick={() => setShowSlotModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: isMobile ? "10px" : "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              width: "min(1100px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "28px",
              padding: isMobile ? "20px" : "32px",
              position: "relative",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {/* 關閉按鈕 */}
            <button
              onClick={() => setShowSlotModal(false)}
              style={{
                position: "absolute",
                top: "18px",
                right: "18px",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "none",
                background: "#f1f5f9",
                fontSize: "24px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ×
            </button>

            {/* Modal 標題 */}
            <h2
              style={{
                textAlign: "center",
                fontSize: isMobile ? "28px" : "44px",
                marginBottom: "8px",
                color: "#334155",
              }}
            >
              儲位詳細資訊：{selectedSlot.slot_code}
            </h2>

            <p
              style={{
                textAlign: "center",
                color: "#64748b",
                marginBottom: "28px",
              }}
            >
              點擊空白處或右上角 × 可關閉
            </p>

            {/* 上方摘要卡 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: "18px",
                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  background: "#eef4ff",
                  borderRadius: "20px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#64748b", fontSize: "16px" }}>
                  儲位編號
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    marginTop: "10px",
                    color: "#4b5563",
                  }}
                >
                  {selectedSlot.slot_code}
                </div>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "20px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#64748b", fontSize: "16px" }}>
                  商品筆數
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    marginTop: "10px",
                    color: "#4b5563",
                  }}
                >
                  {selectedSlotItemCount}
                </div>
              </div>

              <div
                style={{
                  background: "#fff7d6",
                  borderRadius: "20px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#64748b", fontSize: "16px" }}>總數量</div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    marginTop: "10px",
                    color: "#4b5563",
                  }}
                >
                  {selectedSlotTotalQty}
                </div>
              </div>
            </div>

            {/* 商品清單標題 */}
            <h3
              style={{
                textAlign: "center",
                fontSize: isMobile ? "24px" : "34px",
                marginBottom: "20px",
                color: "#334155",
              }}
            >
              此儲位商品清單
            </h3>

            {/* 無庫存 */}
            {selectedSlotInventory.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#94a3b8",
                  fontSize: "20px",
                  background: "#f8fafc",
                  borderRadius: "20px",
                }}
              >
                目前無庫存
              </div>
            ) : (
              // 有庫存：列出所有商品
              <div style={{ display: "grid", gap: "16px" }}>
                {selectedSlotInventory.map((row, index) => (
                  <div
                    key={row.id}
                    style={{
                      border: "1px solid #dbe2ea",
                      borderRadius: "20px",
                      padding: isMobile ? "18px" : "24px",
                      background: "#fbfdff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                      flexDirection: isMobile ? "column" : "row",
                    }}
                  >
                    {/* 左邊：商品資訊 */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: isMobile ? "22px" : "34px",
                          fontWeight: 700,
                          color: "#1e293b",
                          marginBottom: "10px",
                        }}
                      >
                        {getItemName(row)}
                      </div>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: isMobile ? "16px" : "24px",
                        }}
                      >
                        商品序號：{index + 1}
                      </div>
                    </div>

                    {/* 右邊：數量 */}
                    <div
                      style={{
                        minWidth: isMobile ? "100%" : "180px",
                        textAlign: isMobile ? "left" : "right",
                      }}
                    >
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: isMobile ? "16px" : "24px",
                          marginBottom: "8px",
                        }}
                      >
                        庫存數量
                      </div>
                      <div
                        style={{
                          fontSize: isMobile ? "34px" : "50px",
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1,
                        }}
                      >
                        {row.qty}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
