// =========================
// React 功能
// =========================

import { useEffect, useState } from "react";

// =========================
// Supabase 連線
// =========================

import { supabase } from "../services/supabase";

function StockIn() {
  // =========================
  // 商品清單
  // 用來放資料庫中的商品
  // =========================

  const [items, setItems] = useState<any[]>([]);

  // =========================
  // 儲位清單
  // 用來放資料庫中的儲位
  // =========================

  const [slots, setSlots] = useState<any[]>([]);

  // =========================
  // 使用者選擇的商品
  // =========================

  const [itemId, setItemId] = useState("");

  // =========================
  // 使用者選擇的儲位
  // =========================

  const [slotId, setSlotId] = useState("");

  // =========================
  // 異動數量
  // =========================

  const [qty, setQty] = useState(0);

  // =========================
  // 異動類型
  // STOCK_IN = 入庫
  // STOCK_OUT = 出庫
  // =========================

  const [action, setAction] = useState("STOCK_IN");
  const selectedItem = items.find((item) => item.id === itemId);

  const selectedSlot = slots.find((slot) => slot.id === slotId);

  const estimatedQty = action === "STOCK_IN" ? qty : -qty;
  const isMobile = window.innerWidth < 768;

  // =========================
  // 頁面開啟時執行
  // =========================

  useEffect(() => {
    fetchData();
  }, []);

  // =========================
  // 讀取商品與儲位資料
  // =========================

  async function fetchData() {
    const { data: itemData } = await supabase.from("items").select("*");

    const { data: slotData } = await supabase.from("slots").select("*");

    setItems(itemData || []);
    setSlots(slotData || []);
  }

  // =========================
  // 執行庫存異動
  // =========================

  async function stockIn() {
    // 檢查資料是否完整

    if (!itemId || !slotId || qty <= 0) {
      alert("請完整輸入資料");
      return;
    }

    // =========================
    // 查詢目前庫存
    // =========================

    const { data: existing } = await supabase
      .from("inventory")
      .select("*")
      .eq("item_id", itemId)
      .eq("slot_id", slotId)
      .maybeSingle();

    // =========================
    // 如果庫存已存在
    // =========================

    if (existing) {
      // 出庫前檢查庫存是否足夠

      if (action === "STOCK_OUT" && existing.qty < qty) {
        alert("庫存不足");
        return;
      }

      // 更新庫存數量

      await supabase
        .from("inventory")
        .update({
          qty: action === "STOCK_IN" ? existing.qty + qty : existing.qty - qty,
        })
        .eq("id", existing.id);
    } else {
      // =========================
      // 沒有庫存資料
      // =========================

      if (action === "STOCK_OUT") {
        alert("沒有庫存可出庫");
        return;
      }

      // 建立新庫存

      await supabase.from("inventory").insert([
        {
          item_id: itemId,
          slot_id: slotId,
          qty: qty,
        },
      ]);
    }

    // =========================
    // 寫入異動紀錄
    // stock_logs
    // =========================

    const { error } = await supabase.from("stock_logs").insert([
      {
        item_id: itemId,
        slot_id: slotId,
        qty: qty,
        action: action,
      },
    ]);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    alert("異動成功");
  }

  // =========================
  // 畫面區
  // =========================

  return (
    <div style={{ padding: "30px" }}>
      <h1>庫存異動</h1>

      {/* 上方統計卡片 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            background: "#e8f5e9",
            padding: "20px",
            borderRadius: "12px",
            minWidth: "180px",
            textAlign: "center",
          }}
        >
          <h3>總儲位</h3>
          <h2>{slots.length}</h2>
        </div>

        <div
          style={{
            background: "#fff3e0",
            padding: "20px",
            borderRadius: "12px",
            minWidth: "180px",
            textAlign: "center",
          }}
        >
          <h3>異動類型</h3>
          <h2>{action === "STOCK_IN" ? "入庫" : "出庫"}</h2>
        </div>

        <div
          style={{
            background: "#e3f2fd",
            padding: "20px",
            borderRadius: "12px",
            minWidth: "180px",
            textAlign: "center",
          }}
        >
          <h3>異動數量</h3>
          <h2>{qty}</h2>
        </div>
      </div>

      {/* ✅ 左右兩欄：表單 + 異動預覽 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: "30px",
        }}
      >
        {/* 左：表單 */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
          }}
        >
          <p>商品</p>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              boxSizing: "border-box",
            }}
          >
            <option value="">請選擇商品</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <p>儲位</p>
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              boxSizing: "border-box",
            }}
          >
            <option value="">請選擇儲位</option>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.slot_code}
              </option>
            ))}
          </select>

          <p>異動類型</p>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              boxSizing: "border-box",
            }}
          >
            <option value="STOCK_IN">入庫</option>
            <option value="STOCK_OUT">出庫</option>
          </select>

          <p>數量</p>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "10px",
              boxSizing: "border-box",
            }}
          />

          <br />
          <br />
          <button onClick={stockIn}>確認異動</button>
        </div>

        {/* 右：異動預覽 */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
          }}
        >
          <h3>異動預覽</h3>
          <p>商品：{selectedItem?.name || "-"}</p>
          <p>儲位：{selectedSlot?.slot_code || "-"}</p>
          <p>異動類型：{action === "STOCK_IN" ? "入庫" : "出庫"}</p>
          <p>異動數量：{qty}</p>
          <p>異動後：{estimatedQty}</p>
        </div>
      </div>

      <hr style={{ marginTop: "40px" }} />

      {/* 儲位概況 */}
      <h2>儲位概況</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: "15px",
          marginTop: "20px",
        }}
      >
        {slots.map((slot) => (
          <div
            key={slot.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px",
              textAlign: "center",
              background: "#fff",
            }}
          >
            {slot.slot_code}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StockIn;
