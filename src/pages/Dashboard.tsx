import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

type SlotOverview = {
  id: number;
  slot_code: string;
  inventory:
    | {
        qty: number;
        items:
          | {
              name: string;
            }[]
          | null;
      }[]
    | null;
};

function Dashboard() {
  const [itemCount, setItemCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [todayIn, setTodayIn] = useState(0);
  const [todayOut, setTodayOut] = useState(0);

  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [stockChart, setStockChart] = useState<any[]>([]);

  // 新增：儲位概況資料
  const [slotOverview, setSlotOverview] = useState<SlotOverview[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    // 商品數量
    const { count: itemTotal } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true });

    // 庫存筆數
    const { count: inventoryTotal } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true });

    // 總庫存
    const { data: inventoryData } = await supabase
      .from("inventory")
      .select("qty");

    const qtySum =
      inventoryData?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;

    // 今日日期
    const today = new Date().toISOString().split("T")[0];

    // 異動紀錄
    const { data: logs } = await supabase.from("stock_logs").select("*");

    // 今日入庫
    const inQty =
      logs
        ?.filter(
          (x) =>
            x.action === "STOCK_IN" && x.created_at?.split("T")[0] === today,
        )
        .reduce((sum, x) => sum + x.qty, 0) || 0;

    // 今日出庫
    const outQty =
      logs
        ?.filter(
          (x) =>
            x.action === "STOCK_OUT" && x.created_at?.split("T")[0] === today,
        )
        .reduce((sum, x) => sum + x.qty, 0) || 0;

    // 低庫存
    const { data: lowStock } = await supabase
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

    // 圖表資料
    const { data: chartData } = await supabase.from("inventory").select(`
      qty,
      items (
        name
      )
    `);

    // ===== 新增：儲位概況 =====
    // 會抓每個 slot 的庫存與商品名稱
    const { data: slotsData, error: slotsError } = await supabase
      .from("slots")
      .select(
        `
        id,
        slot_code,
        inventory (
          qty,
          items (
            name
          )
        )
      `,
      )
      .order("slot_code", { ascending: true });

    if (slotsError) {
      console.error("讀取儲位概況失敗：", slotsError);
    }

    setItemCount(itemTotal || 0);
    setInventoryCount(inventoryTotal || 0);
    setTotalQty(qtySum);

    setTodayIn(inQty);
    setTodayOut(outQty);

    setLowStockItems(lowStock || []);
    setStockChart(chartData || []);
    setSlotOverview((slotsData as SlotOverview[]) || []);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1
        style={{
          fontSize: window.innerWidth < 768 ? "24px" : "42px",
          textAlign: "center",
          marginBottom: "20px",
          wordBreak: "break-word",
          lineHeight: "1.2",
        }}
      >
        智慧倉儲管理儀表板
      </h1>

      {/* KPI 卡片 */}
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
            marginBottom: "10px",
            borderRadius: "10px",
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
            borderRadius: "10px",
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
            borderRadius: "10px",
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
            borderRadius: "10px",
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
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <h2>總庫存量</h2>
          <h1>{totalQty}</h1>
        </div>
      </div>

      {/* 儲位概況 */}
      <h2
        style={{
          marginTop: "50px",
          textAlign: "center",
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
        }}
      >
        儲位概況
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        {slotOverview.map((slot) => (
          <div
            key={slot.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "14px",
              padding: "18px",
              minHeight: "130px",
              backgroundColor: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* 儲位編號 */}
            <div
              style={{
                fontSize: "28px",
                fontWeight: 600,
                color: "#6d657d",
                marginBottom: "12px",
              }}
            >
              {slot.slot_code}
            </div>

            {/* 儲位內容 */}
            {slot.inventory && slot.inventory.length > 0 ? (
              <div style={{ width: "100%" }}>
                {slot.inventory.map((inv, index) => (
                  <div key={index} style={{ marginBottom: "8px" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {inv.items?.[0]?.name || "未命名商品"}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        marginTop: "4px",
                      }}
                    >
                      數量：{inv.qty}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "14px",
                  color: "#9ca3af",
                }}
              >
                目前無庫存
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 低庫存警示 */}
      <h2 style={{ marginTop: "50px" }}>⚠ 低庫存警示</h2>

      {lowStockItems.length === 0 ? (
        <p>目前沒有低庫存商品</p>
      ) : (
        lowStockItems.map((item, index) => (
          <div
            key={index}
            style={{
              border: "2px solid red",
              padding: "15px",
              marginBottom: "10px",
              borderRadius: "10px",
              backgroundColor: "#fff5f5",
            }}
          >
            <strong>{item.items?.name}</strong>
            <p>庫存只剩：{item.qty}</p>
          </div>
        ))
      )}

      {/* 庫存分布圖 */}
      <h2 style={{ marginTop: "50px" }}>📊 庫存分布圖</h2>

      <div
        style={{
          marginTop: "20px",
          maxWidth: "900px",
        }}
      >
        {stockChart.map((item, index) => (
          <div
            key={index}
            style={{
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <span>{item.items?.name}</span>
              <span>{item.qty}</span>
            </div>

            <div
              style={{
                height: "30px",
                backgroundColor: "#e5e7eb",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${item.qty * 30}px`,
                  height: "100%",
                  backgroundColor: "#2563eb",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
