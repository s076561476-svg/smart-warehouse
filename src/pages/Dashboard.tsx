import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

/* =========================
   型別
========================= */
type LowStockItem = {
  qty: number;
  items?:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

type InventoryRow = {
  id?: string;
  item_id: string;
  slot_id: string;
  qty: number;
  items?:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  slots?:
    | {
        slot_code: string;
      }
    | {
        slot_code: string;
      }[]
    | null;
};

type Slot = {
  id: string;
  slot_code: string;
};

type SlotOverviewItem = {
  slot_id: string;
  slot_code: string;
  totalQty: number;
  itemCount: number;
  status: "empty" | "used" | "planned";
  inventory: {
    item_id: string;
    item_name: string;
    qty: number;
  }[];
};

function Dashboard() {
  /* =========================
     KPI
  ========================= */
  const [itemCount, setItemCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [todayIn, setTodayIn] = useState(0);
  const [todayOut, setTodayOut] = useState(0);

  /* =========================
     低庫存
  ========================= */
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  /* =========================
     儲位概況
  ========================= */
  const [slots, setSlots] = useState<Slot[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  /* =========================
     Modal
  ========================= */
  const [selectedSlot, setSelectedSlot] = useState<SlotOverviewItem | null>(
    null,
  );

  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    loadDashboard();
  }, []);

  /* =========================
     讀取 Dashboard 所有資料
  ========================= */
  async function loadDashboard() {
    // 1. 商品總數
    const { count: itemTotal } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true });

    // 2. 庫存筆數
    const { count: inventoryTotal } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true });

    // 3. 總庫存量 + inventory 關聯資料
    const { data: inventoryData, error: inventoryError } = await supabase.from(
      "inventory",
    ).select(`
        id,
        item_id,
        slot_id,
        qty,
        items (
          name
        ),
        slots (
          slot_code
        )
      `);

    if (inventoryError) {
      console.error("讀取 inventory 失敗：", inventoryError);
    }

    const inventoryRows = (inventoryData as InventoryRow[]) || [];

    const qtySum =
      inventoryRows.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;

    // 4. 今日日期
    const today = new Date().toISOString().split("T")[0];

    // 5. 異動紀錄
    const { data: logs, error: logsError } = await supabase
      .from("stock_logs")
      .select("*");

    if (logsError) {
      console.error("讀取 stock_logs 失敗：", logsError);
    }

    const inQty =
      logs
        ?.filter(
          (x) =>
            x.action === "STOCK_IN" && x.created_at?.split("T")[0] === today,
        )
        .reduce((sum, x) => sum + x.qty, 0) || 0;

    const outQty =
      logs
        ?.filter(
          (x) =>
            x.action === "STOCK_OUT" && x.created_at?.split("T")[0] === today,
        )
        .reduce((sum, x) => sum + x.qty, 0) || 0;

    // 6. 低庫存商品
    const { data: lowStock, error: lowStockError } = await supabase
      .from("inventory")
      .select(
        `
        qty,
        items (
          name
        )
      `,
      )
      .lt("qty", 20);

    if (lowStockError) {
      console.error("讀取低庫存失敗：", lowStockError);
    }

    // 7. 讀取儲位
    const { data: slotData, error: slotError } = await supabase
      .from("slots")
      .select("id, slot_code")
      .order("slot_code", { ascending: true });

    if (slotError) {
      console.error("讀取 slots 失敗：", slotError);
    }

    // 寫入 state
    setItemCount(itemTotal || 0);
    setInventoryCount(inventoryTotal || 0);
    setTotalQty(qtySum);
    setTodayIn(inQty);
    setTodayOut(outQty);
    setLowStockItems((lowStock as LowStockItem[]) || []);
    setInventory(inventoryRows);
    setSlots((slotData as Slot[]) || []);
  }

  /* =========================
     工具：抓商品名稱
     相容 Supabase 回傳為物件或陣列
  ========================= */
  function getItemName(
    item:
      | {
          name: string;
        }
      | {
          name: string;
        }[]
      | null
      | undefined,
  ) {
    if (!item) return "未命名商品";
    if (Array.isArray(item)) return item[0]?.name || "未命名商品";
    return item.name || "未命名商品";
  }

  /* =========================
     組合儲位概況資料
  ========================= */
  const slotOverview = useMemo<SlotOverviewItem[]>(() => {
    return slots.map((slot) => {
      const slotInventory = inventory
        .filter((inv) => inv.slot_id === slot.id && (inv.qty || 0) > 0)
        .map((inv) => ({
          item_id: inv.item_id,
          item_name: getItemName(inv.items),
          qty: inv.qty || 0,
        }));

      const totalQty = slotInventory.reduce((sum, item) => sum + item.qty, 0);
      const itemCount = slotInventory.length;

      // 目前先做兩種邏輯：
      // used = 有庫存
      // empty = 沒庫存
      // planned 先保留欄位，之後你有預約資料再接進來
      let status: "empty" | "used" | "planned" = "empty";
      if (totalQty > 0) {
        status = "used";
      }

      return {
        slot_id: slot.id,
        slot_code: slot.slot_code,
        totalQty,
        itemCount,
        status,
        inventory: slotInventory,
      };
    });
  }, [slots, inventory]);

  /* =========================
     狀態顏色 / 文字
  ========================= */
  function getStatusInfo(status: "empty" | "used" | "planned") {
    switch (status) {
      case "used":
        return {
          label: "使用中",
          dot: "#ef4444",
          bg: "#fef2f2",
          border: "#fecaca",
        };
      case "planned":
        return {
          label: "預計使用",
          dot: "#f59e0b",
          bg: "#fffbeb",
          border: "#fde68a",
        };
      case "empty":
      default:
        return {
          label: "空位",
          dot: "#22c55e",
          bg: "#f0fdf4",
          border: "#bbf7d0",
        };
    }
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* =========================
          標題
      ========================= */}
      <h1
        style={{
          fontSize: isMobile ? "28px" : "40px",
          marginBottom: "20px",
          color: "#1e293b",
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
          gap: "18px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{ color: "#1d4ed8", fontWeight: 700, marginBottom: "8px" }}
          >
            商品總數
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>
            {itemCount}
          </div>
        </div>

        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{ color: "#15803d", fontWeight: 700, marginBottom: "8px" }}
          >
            庫存筆數
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>
            {inventoryCount}
          </div>
        </div>

        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{ color: "#b45309", fontWeight: 700, marginBottom: "8px" }}
          >
            總庫存量
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>
            {totalQty}
          </div>
        </div>

        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{ color: "#047857", fontWeight: 700, marginBottom: "8px" }}
          >
            今日入庫
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>
            {todayIn}
          </div>
        </div>

        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <div
            style={{ color: "#dc2626", fontWeight: 700, marginBottom: "8px" }}
          >
            今日出庫
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>
            {todayOut}
          </div>
        </div>
      </div>

      {/* =========================
          低庫存警示
      ========================= */}
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: "28px",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#334155" }}>⚠ 低庫存警示</h2>

        {lowStockItems.length === 0 ? (
          <p style={{ color: "#64748b" }}>目前沒有低庫存商品</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
              gap: "14px",
              marginTop: "16px",
            }}
          >
            {lowStockItems.map((item, index) => (
              <div
                key={index}
                style={{
                  background: "#fff5f5",
                  border: "1px solid #fecaca",
                  borderRadius: "14px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#991b1b",
                    marginBottom: "8px",
                  }}
                >
                  {getItemName(item.items)}
                </div>
                <div style={{ color: "#7f1d1d" }}>庫存只剩：{item.qty}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================
          儲位狀態圖例
      ========================= */}
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#334155" }}>儲位狀態說明</h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "18px",
            marginTop: "14px",
          }}
        >
          {[
            { color: "#22c55e", label: "空位" },
            { color: "#ef4444", label: "使用中" },
            { color: "#f59e0b", label: "預計使用" },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: item.color,
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#334155", fontWeight: 600 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================
          儲位概況
      ========================= */}
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#334155" }}>儲位概況</h2>

        {slotOverview.length === 0 ? (
          <p style={{ color: "#64748b" }}>目前沒有儲位資料</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, 1fr)"
                : "repeat(4, 1fr)",
              gap: "14px",
              marginTop: "18px",
            }}
          >
            {slotOverview.map((slot) => {
              const statusInfo = getStatusInfo(slot.status);

              return (
                <div
                  key={slot.slot_id}
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    cursor: "pointer",
                    border: `1px solid ${statusInfo.border}`,
                    borderRadius: "16px",
                    padding: "16px",
                    background: statusInfo.bg,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "18px",
                        color: "#1e293b",
                      }}
                    >
                      {slot.slot_code}
                    </div>

                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: statusInfo.dot,
                        display: "inline-block",
                      }}
                    />
                  </div>

                  <div style={{ color: "#475569", fontSize: "14px" }}>
                    <div style={{ marginBottom: "6px" }}>
                      狀態：{statusInfo.label}
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      商品數：{slot.itemCount}
                    </div>
                    <div>總數量：{slot.totalQty}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================
          Modal：儲位完整內容
      ========================= */}
      {selectedSlot && (
        <div
          onClick={() => setSelectedSlot(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "20px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              padding: "24px",
            }}
          >
            {/* 標題列 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    color: "#1e293b",
                  }}
                >
                  {selectedSlot.slot_code}
                </div>
                <div style={{ color: "#64748b", marginTop: "6px" }}>
                  儲位詳細內容
                </div>
              </div>

              <button
                onClick={() => setSelectedSlot(null)}
                style={{
                  border: "none",
                  background: "#e2e8f0",
                  color: "#1e293b",
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* 基本資訊 */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ marginBottom: "10px", color: "#334155" }}>
                狀態：{getStatusInfo(selectedSlot.status).label}
              </div>
              <div style={{ marginBottom: "10px", color: "#334155" }}>
                商品數：{selectedSlot.itemCount}
              </div>
              <div style={{ color: "#334155" }}>
                總數量：{selectedSlot.totalQty}
              </div>
            </div>

            {/* 商品清單 */}
            <h3 style={{ color: "#334155", marginBottom: "14px" }}>商品清單</h3>

            {selectedSlot.inventory.length === 0 ? (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "14px",
                  padding: "18px",
                  color: "#64748b",
                }}
              >
                這個儲位目前沒有商品
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                {selectedSlot.inventory.map((item, index) => (
                  <div
                    key={`${item.item_id}-${index}`}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: "8px",
                      }}
                    >
                      {item.item_name}
                    </div>

                    <div style={{ color: "#475569" }}>數量：{item.qty}</div>
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
