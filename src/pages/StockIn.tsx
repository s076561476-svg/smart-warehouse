import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

/* =========================
   型別定義
========================= */
type Item = {
  id: string;
  name: string;
};

type Slot = {
  id: string;
  slot_code: string;
};

type InventoryRow = {
  id?: string;
  item_id: string;
  slot_id: string;
  qty: number;
  items?: {
    name: string;
  }[];
  slots?: {
    slot_code: string;
  }[];
};

type SlotCardData = {
  slot_id: string;
  slot_code: string;
  inventory: {
    item_id: string;
    item_name: string;
    qty: number;
  }[];
  totalQty: number;
  itemCount: number;
  status: "used" | "reserved" | "empty";
  statusText: string;
};

/* =========================
   預計使用儲位（黃燈）
   這裡先手動寫死，之後如果你想改成資料庫控制也可以
========================= */
const RESERVED_SLOT_CODES = ["A-02-04", "A-03-01"];

/* =========================
   頁面元件
========================= */
function StockIn() {
  /* =========================
     基本資料 state
  ========================= */
  const [items, setItems] = useState<Item[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  /* =========================
     表單 state
  ========================= */
  const [itemId, setItemId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [qty, setQty] = useState(0);
  const [action, setAction] = useState("STOCK_IN");

  /* =========================
     儲位卡片 / 彈窗 state
  ========================= */
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);

  const isMobile = window.innerWidth < 768;

  /* =========================
     異動預覽用
  ========================= */
  const selectedItem = items.find((item) => item.id === itemId);
  const selectedSlot = slots.find((slot) => slot.id === slotId);
  const estimatedQty = action === "STOCK_IN" ? qty : -qty;

  /* =========================
     初始載入
  ========================= */
  useEffect(() => {
    fetchData();
  }, []);

  /* =========================
     讀取商品 / 儲位 / 庫存
  ========================= */
  async function fetchData() {
    // 商品
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id, name")
      .order("id", { ascending: true });

    if (itemError) {
      console.error("讀取商品失敗：", itemError);
    }

    // 儲位
    const { data: slotData, error: slotError } = await supabase
      .from("slots")
      .select("id, slot_code")
      .order("slot_code", { ascending: true });

    if (slotError) {
      console.error("讀取儲位失敗：", slotError);
    }

    // 庫存
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
        ),
        slots (
          slot_code
        )
      `,
      )
      .order("slot_id", { ascending: true });

    if (inventoryError) {
      console.error("讀取庫存失敗：", inventoryError);
    }

    setItems((itemData as Item[]) || []);
    setSlots((slotData as Slot[]) || []);
    setInventory((inventoryData as InventoryRow[]) || []);
  }

  /* =========================
     執行庫存異動
  ========================= */
  async function stockIn() {
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
      console.error(existingError);
      alert("讀取目前庫存失敗");
      return;
    }

    // 有舊庫存 → 更新
    if (existing) {
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
        console.error(updateError);
        alert("更新庫存失敗");
        return;
      }
    } else {
      // 沒有庫存資料，但使用者要出庫 → 不允許
      if (action === "STOCK_OUT") {
        alert("沒有庫存可出庫");
        return;
      }

      // 建立新庫存
      const { error: insertError } = await supabase.from("inventory").insert([
        {
          item_id: itemId,
          slot_id: slotId,
          qty: qty,
        },
      ]);

      if (insertError) {
        console.error(insertError);
        alert("建立新庫存失敗");
        return;
      }
    }

    // 寫入異動紀錄
    const { error: logError } = await supabase.from("stock_logs").insert([
      {
        item_id: itemId,
        slot_id: slotId,
        qty: qty,
        action: action,
      },
    ]);

    if (logError) {
      console.error(logError);
      alert(logError.message);
      return;
    }

    alert("異動成功");

    // 清空表單
    setItemId("");
    setSlotId("");
    setQty(0);
    setAction("STOCK_IN");

    // 重新抓資料
    await fetchData();
  }

  /* =========================
     整理成「儲位概況卡片資料」
  ========================= */
  const slotOverview = useMemo<SlotCardData[]>(() => {
    return slots.map((slot) => {
      // 找出此儲位所有庫存資料（qty > 0 才算真的有庫存）
      const slotInventory = inventory
        .filter((inv) => inv.slot_id === slot.id && (inv.qty || 0) > 0)
        .map((inv) => ({
          item_id: inv.item_id,
          item_name: inv.items?.[0]?.name || "未命名商品",
          qty: inv.qty || 0,
        }));

      const totalQty = slotInventory.reduce((sum, item) => sum + item.qty, 0);
      const itemCount = slotInventory.length;

      // 狀態判斷：
      // 1. 有庫存 = 紅燈 / 使用中
      // 2. 沒庫存但在 RESERVED_SLOT_CODES = 黃燈 / 預計使用
      // 3. 其餘 = 綠燈 / 空位
      let status: "used" | "reserved" | "empty" = "empty";
      let statusText = "空儲位";

      if (slotInventory.length > 0) {
        status = "used";
        statusText = "使用中";
      } else if (RESERVED_SLOT_CODES.includes(slot.slot_code)) {
        status = "reserved";
        statusText = "預計使用";
      } else {
        status = "empty";
        statusText = "空儲位";
      }

      return {
        slot_id: slot.id,
        slot_code: slot.slot_code,
        inventory: slotInventory,
        totalQty,
        itemCount,
        status,
        statusText,
      };
    });
  }, [slots, inventory]);

  /* =========================
     目前點到的儲位資料
  ========================= */
  const selectedSlotData = useMemo(() => {
    if (!selectedSlotId) return null;
    return slotOverview.find((slot) => slot.slot_id === selectedSlotId) || null;
  }, [selectedSlotId, slotOverview]);

  /* =========================
     燈號顏色
  ========================= */
  function getStatusColor(status: "used" | "reserved" | "empty") {
    if (status === "used") return "#ef4444"; // 紅燈：使用中 / 有庫存
    if (status === "reserved") return "#eab308"; // 黃燈：預計使用 / 預留
    return "#22c55e"; // 綠燈：空位 / 無庫存
  }

  /* =========================
     JSX 畫面
  ========================= */
  return (
    <div style={{ padding: "30px" }}>
      <h1
        style={{
          fontSize: isMobile ? "28px" : "40px",
          marginBottom: "20px",
          color: "#1e293b",
        }}
      >
        庫存異動
      </h1>

      {/* =========================
          上方統計卡片
      ========================= */}
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
            borderRadius: "14px",
            minWidth: "180px",
            textAlign: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>總儲位</h3>
          <h2>{slots.length}</h2>
        </div>

        <div
          style={{
            background: "#fff3e0",
            padding: "20px",
            borderRadius: "14px",
            minWidth: "180px",
            textAlign: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>異動類型</h3>
          <h2>{action === "STOCK_IN" ? "入庫" : "出庫"}</h2>
        </div>

        <div
          style={{
            background: "#e3f2fd",
            padding: "20px",
            borderRadius: "14px",
            minWidth: "180px",
            textAlign: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>異動數量</h3>
          <h2>{qty}</h2>
        </div>
      </div>

      {/* =========================
          左右兩欄：表單 + 異動預覽
      ========================= */}
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
            borderRadius: "18px",
            padding: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <p style={{ marginBottom: "8px", fontWeight: 600 }}>商品</p>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "14px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="">請選擇商品</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <p style={{ marginBottom: "8px", fontWeight: 600 }}>儲位</p>
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "14px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="">請選擇儲位</option>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.slot_code}
              </option>
            ))}
          </select>

          <p style={{ marginBottom: "8px", fontWeight: 600 }}>異動類型</p>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "14px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="STOCK_IN">入庫</option>
            <option value="STOCK_OUT">出庫</option>
          </select>

          <p style={{ marginBottom: "8px", fontWeight: 600 }}>數量</p>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
            }}
          />

          <br />
          <br />
          <button
            onClick={stockIn}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "12px 20px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            確認異動
          </button>
        </div>

        {/* 右：異動預覽 */}
        <div
          style={{
            background: "white",
            borderRadius: "18px",
            padding: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>異動預覽</h3>
          <p>商品：{selectedItem?.name || "-"}</p>
          <p>儲位：{selectedSlot?.slot_code || "-"}</p>
          <p>異動類型：{action === "STOCK_IN" ? "入庫" : "出庫"}</p>
          <p>異動數量：{qty}</p>
          <p>異動後：{estimatedQty}</p>
        </div>
      </div>

      <hr style={{ marginTop: "40px", marginBottom: "30px" }} />

      {/* =========================
          儲位概況
      ========================= */}
      <h2
        style={{
          marginBottom: "16px",
          fontSize: isMobile ? "24px" : "30px",
          color: "#334155",
        }}
      >
        儲位概況
      </h2>

      {/* 燈號說明 */}
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "16px 20px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

      {/* 儲位卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: "18px",
        }}
      >
        {slotOverview.map((slot) => {
          const isSelected = selectedSlotId === slot.slot_id;

          return (
            <div
              key={slot.slot_id}
              onClick={() => {
                setSelectedSlotId(slot.slot_id);
                setShowSlotModal(true);
              }}
              style={{
                position: "relative",
                border: isSelected ? "2px solid #2563eb" : "1px solid #d1d5db",
                borderRadius: "18px",
                padding: isMobile ? "18px 12px" : "22px 16px",
                textAlign: "center",
                background: isSelected ? "#f8fbff" : "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                minHeight: isMobile ? "180px" : "220px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                transition: "all 0.2s ease",
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
                  background: getStatusColor(slot.status),
                  boxShadow: `0 0 12px ${getStatusColor(slot.status)}`,
                }}
              />

              {/* 儲位編號 */}
              <div
                style={{
                  fontSize: isMobile ? "26px" : "34px",
                  fontWeight: 700,
                  color: "#667085",
                  marginBottom: "14px",
                }}
              >
                {slot.slot_code}
              </div>

              {/* 狀態 */}
              <div
                style={{
                  fontSize: isMobile ? "18px" : "20px",
                  color: "#64748b",
                  marginBottom: "14px",
                }}
              >
                {slot.statusText}
              </div>

              {slot.inventory.length > 0 ? (
                <>
                  <div
                    style={{
                      fontSize: isMobile ? "16px" : "18px",
                      color: "#475569",
                      marginBottom: "8px",
                    }}
                  >
                    商品筆數：{slot.itemCount}
                  </div>

                  <div
                    style={{
                      fontSize: isMobile ? "16px" : "18px",
                      color: "#475569",
                    }}
                  >
                    總數量：{slot.totalQty}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    fontSize: isMobile ? "16px" : "18px",
                    color: "#94a3b8",
                  }}
                >
                  目前無庫存
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================
          彈窗：儲位詳細資訊
      ========================= */}
      {showSlotModal && selectedSlotData && (
        <div
          onClick={() => setShowSlotModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "900px",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: isMobile ? "20px" : "28px",
              position: "relative",
            }}
          >
            {/* 關閉按鈕 */}
            <button
              onClick={() => setShowSlotModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                border: "none",
                background: "#f1f5f9",
                cursor: "pointer",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              ×
            </button>

            {/* 標題 */}
            <div style={{ marginBottom: "20px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: isMobile ? "24px" : "30px",
                  color: "#334155",
                }}
              >
                儲位詳細資訊：{selectedSlotData.slot_code}
              </h2>
              <p
                style={{
                  marginTop: "8px",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                點擊空白處或右上角 × 可關閉
              </p>
            </div>

            {/* 無庫存 */}
            {selectedSlotData.inventory.length === 0 ? (
              <div
                style={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: "14px",
                  padding: "30px",
                  textAlign: "center",
                  color: "#94a3b8",
                  background: "#f8fafc",
                }}
              >
                此儲位目前無庫存
              </div>
            ) : (
              <>
                {/* 摘要卡片 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      background: "#eff6ff",
                      borderRadius: "14px",
                      padding: "18px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ color: "#64748b", marginBottom: "8px" }}>
                      儲位編號
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      {selectedSlotData.slot_code}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: "14px",
                      padding: "18px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ color: "#64748b", marginBottom: "8px" }}>
                      商品筆數
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      {selectedSlotData.inventory.length}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fef3c7",
                      borderRadius: "14px",
                      padding: "18px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ color: "#64748b", marginBottom: "8px" }}>
                      總數量
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      {selectedSlotData.totalQty}
                    </div>
                  </div>
                </div>

                {/* 商品清單 */}
                <div>
                  <h3 style={{ marginBottom: "14px", color: "#334155" }}>
                    此儲位商品清單
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                    }}
                  >
                    {selectedSlotData.inventory.map((inv, index) => (
                      <div
                        key={`${inv.item_id}-${index}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "14px",
                          padding: "16px 18px",
                          background: "#f8fafc",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: isMobile ? "flex-start" : "center",
                          flexDirection: isMobile ? "column" : "row",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: 700,
                              color: "#1e293b",
                              marginBottom: "6px",
                            }}
                          >
                            {inv.item_name}
                          </div>
                          <div style={{ color: "#64748b", fontSize: "14px" }}>
                            商品序號：{index + 1}
                          </div>
                        </div>

                        <div
                          style={{
                            minWidth: "120px",
                            textAlign: isMobile ? "left" : "right",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#64748b",
                              marginBottom: "4px",
                            }}
                          >
                            庫存數量
                          </div>
                          <div
                            style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {inv.qty}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StockIn;
