// =========================
// React 功能
// =========================
import { useEffect, useMemo, useState } from "react";

// =========================
// Supabase 連線
// =========================
import { supabase } from "../services/supabase";

// =========================
// 型別定義
// =========================
type Item = {
  id: string;
  name: string;
};

type Slot = {
  id: string;
  slot_code: string;
};

type InventoryRow = {
  id: string;
  item_id: string;
  slot_id: string;
  qty: number;
  items?:
    | {
        name: string;
      }[]
    | null;
};

type SlotOverview = {
  id: string;
  slot_code: string;
  inventory: {
    item_id: string;
    qty: number;
    item_name: string;
  }[];
};

function StockIn() {
  // =========================
  // 商品 / 儲位 / 庫存資料
  // =========================
  const [items, setItems] = useState<Item[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryRow[]>([]);

  // =========================
  // 表單狀態
  // =========================
  const [itemId, setItemId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [qty, setQty] = useState(0);
  const [action, setAction] = useState("STOCK_IN");

  const isMobile = window.innerWidth < 768;

  // =========================
  // 頁面載入
  // =========================
  useEffect(() => {
    fetchData();
  }, []);

  // =========================
  // 讀取資料
  // =========================
  async function fetchData() {
    // 商品
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("*")
      .order("id", { ascending: true });

    if (itemError) {
      console.error("讀取商品失敗：", itemError);
    }

    // 儲位
    const { data: slotData, error: slotError } = await supabase
      .from("slots")
      .select("*")
      .order("slot_code", { ascending: true });

    if (slotError) {
      console.error("讀取儲位失敗：", slotError);
    }

    // 庫存（含商品名稱）
    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory")
      .select(
        `
        id,
        item_id,
        slot_id,
        qty,
        items (
          name
        )
      `,
      )
      .order("slot_id", { ascending: true });

    if (inventoryError) {
      console.error("讀取庫存失敗：", inventoryError);
    }

    setItems((itemData as Item[]) || []);
    setSlots((slotData as Slot[]) || []);
    setInventoryList((inventoryData as InventoryRow[]) || []);
  }

  // =========================
  // 目前選到的商品 / 儲位
  // =========================
  const selectedItem = items.find((item) => String(item.id) === String(itemId));
  const selectedSlot = slots.find((slot) => String(slot.id) === String(slotId));

  // =========================
  // 查詢目前這個「商品 + 儲位」的現有庫存
  // =========================
  const currentInventory = inventoryList.find(
    (row) =>
      String(row.item_id) === String(itemId) &&
      String(row.slot_id) === String(slotId),
  );

  // =========================
  // 異動後數量（真實預覽）
  // =========================
  const estimatedQty = useMemo(() => {
    const currentQty = currentInventory?.qty || 0;

    if (!itemId || !slotId || qty <= 0) return currentQty;

    if (action === "STOCK_IN") {
      return currentQty + qty;
    }

    return currentQty - qty;
  }, [action, qty, itemId, slotId, currentInventory]);

  // =========================
  // 組出「儲位概況」資料
  // 每個儲位底下帶 inventory 清單
  // =========================
  const slotOverview: SlotOverview[] = useMemo(() => {
    return slots.map((slot) => {
      const slotInventory = inventoryList
        .filter((inv) => String(inv.slot_id) === String(slot.id))
        .map((inv) => ({
          item_id: inv.item_id,
          qty: inv.qty,
          item_name: inv.items?.[0]?.name || "未命名商品",
        }));

      return {
        id: slot.id,
        slot_code: slot.slot_code,
        inventory: slotInventory,
      };
    });
  }, [slots, inventoryList]);

  // =========================
  // 執行庫存異動
  // =========================
  async function stockIn() {
    // 檢查資料是否完整
    if (!itemId || !slotId || qty <= 0) {
      alert("請完整輸入資料");
      return;
    }

    // 查詢目前庫存
    const { data: existing, error: existingError } = await supabase
      .from("inventory")
      .select("*")
      .eq("item_id", itemId)
      .eq("slot_id", slotId)
      .maybeSingle();

    if (existingError) {
      console.error("查詢庫存失敗：", existingError);
      alert("查詢庫存失敗");
      return;
    }

    // =========================
    // 如果庫存已存在
    // =========================
    if (existing) {
      // 出庫前檢查庫存是否足夠
      if (action === "STOCK_OUT" && existing.qty < qty) {
        alert("庫存不足");
        return;
      }

      const newQty =
        action === "STOCK_IN" ? existing.qty + qty : existing.qty - qty;

      const { error: updateError } = await supabase
        .from("inventory")
        .update({ qty: newQty })
        .eq("id", existing.id);

      if (updateError) {
        console.error("更新庫存失敗：", updateError);
        alert("更新庫存失敗");
        return;
      }
    } else {
      // =========================
      // 沒有庫存資料
      // =========================
      if (action === "STOCK_OUT") {
        alert("沒有庫存可出庫");
        return;
      }

      const { error: insertError } = await supabase.from("inventory").insert([
        {
          item_id: itemId,
          slot_id: slotId,
          qty: qty,
        },
      ]);

      if (insertError) {
        console.error("建立庫存失敗：", insertError);
        alert("建立庫存失敗");
        return;
      }
    }

    // =========================
    // 寫入異動紀錄
    // =========================
    const { error: logError } = await supabase.from("stock_logs").insert([
      {
        item_id: itemId,
        slot_id: slotId,
        qty: qty,
        action: action,
      },
    ]);

    if (logError) {
      console.error("寫入異動紀錄失敗：", logError);
      alert(logError.message);
      return;
    }

    alert("異動成功");

    // 清空表單
    setItemId("");
    setSlotId("");
    setQty(0);
    setAction("STOCK_IN");

    // 重新抓最新資料，讓下方儲位概況同步更新
    fetchData();
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
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

      {/* 左右兩欄：表單 + 異動預覽 */}
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
          <p>目前庫存：{currentInventory?.qty || 0}</p>
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
        {slotOverview.map((slot) => (
          <div
            key={slot.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "14px",
              padding: "18px",
              background: "#fff",
              minHeight: "180px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                textAlign: "center",
                fontSize: "28px",
                color: "#6d6780",
              }}
            >
              {slot.slot_code}
            </h3>

            {slot.inventory.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#9ca3af",
                  marginTop: "40px",
                }}
              >
                目前無庫存
              </p>
            ) : (
              slot.inventory.map((inv, index) => (
                <div
                  key={`${slot.id}-${inv.item_id}-${index}`}
                  style={{
                    marginBottom: "14px",
                    textAlign: "center",
                    borderBottom:
                      index !== slot.inventory.length - 1
                        ? "1px dashed #e5e7eb"
                        : "none",
                    paddingBottom:
                      index !== slot.inventory.length - 1 ? "10px" : "0",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "20px",
                      marginBottom: "4px",
                    }}
                  >
                    {inv.item_name}
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "16px",
                    }}
                  >
                    數量：{inv.qty}
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StockIn;
