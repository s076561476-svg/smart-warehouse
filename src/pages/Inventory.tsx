import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

type InventoryItem = {
  id: number;
  qty: number;
  items: { name: string };
  slots: { slot_code: string };
};

function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select(`*, items(name), slots(slot_code)`);
    if (!error) setInventory(data || []);
    setLoading(false);
  }

  const filtered = inventory.filter(
    (item) =>
      item.items?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.slots?.slot_code?.toLowerCase().includes(search.toLowerCase()),
  );

  const total = inventory.length;
  const low = inventory.filter((i) => i.qty > 0 && i.qty < 20).length;
  const out = inventory.filter((i) => i.qty === 0).length;
  const normal = inventory.filter((i) => i.qty >= 20).length;

  function statusLabel(qty: number) {
    if (qty === 0)
      return { label: "缺貨", bg: "#fee2e2", color: "#b91c1c", dot: "#ef4444" };
    if (qty < 20)
      return {
        label: "庫存偏低",
        bg: "#fef9c3",
        color: "#92400e",
        dot: "#f59e0b",
      };
    return { label: "正常", bg: "#dcfce7", color: "#166534", dot: "#22c55e" };
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "28px 36px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          flexDirection: window.innerWidth < 768 ? "column" : "row",
          gap: "12px",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Warehouse Management System
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#0f172a",
              margin: 0,
            }}
          >
            庫存查詢
          </h1>
        </div>
        <button
          onClick={fetchInventory}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "6px",
            background: "#0f172a",
            color: "#f1f5f9",
            border: "none",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          ↻ 重新整理
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            window.innerWidth < 768 ? "repeat(2,1fr)" : "repeat(4,1fr)",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {[
          {
            label: "總庫存品項",
            value: total,
            color: "#3b82f6",
            bg: "#eff6ff",
            border: "#bfdbfe",
          },
          {
            label: "正常",
            value: normal,
            color: "#16a34a",
            bg: "#f0fdf4",
            border: "#bbf7d0",
          },
          {
            label: "庫存偏低",
            value: low,
            color: "#d97706",
            bg: "#fffbeb",
            border: "#fde68a",
          },
          {
            label: "缺貨",
            value: out,
            color: "#dc2626",
            bg: "#fef2f2",
            border: "#fecaca",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: "10px",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                marginBottom: "6px",
                fontWeight: 500,
              }}
            >
              {card.label}
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: 700, color: card.color }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            flexDirection: window.innerWidth < 768 ? "column" : "row",
            gap: "12px",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>
            庫存明細
            <span
              style={{
                marginLeft: "8px",
                fontSize: "12px",
                fontWeight: 400,
                background: "#e2e8f0",
                color: "#475569",
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              {filtered.length} 筆
            </span>
          </span>
          <input
            type="text"
            placeholder="搜尋商品 / 儲位..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "7px 12px",
              width: "220px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#334155",
              outline: "none",
              background: "#fff",
            }}
          />
        </div>

        {/* Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {["序號", "商品名稱", "儲位", "庫存數量", "狀態"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "11px 16px",
                    textAlign: i === 3 ? "right" : "left",
                    color: "#64748b",
                    fontWeight: 600,
                    fontSize: "12px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "48px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  載入中...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "48px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  無符合條件的資料
                </td>
              </tr>
            ) : (
              filtered.map((item, index) => {
                const status = statusLabel(item.qty);
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f8fafc")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#94a3b8",
                        fontSize: "13px",
                      }}
                    >
                      {String(index + 1).padStart(3, "0")}
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        color: "#0f172a",
                        fontWeight: 500,
                      }}
                    >
                      {item.items?.name}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span
                        style={{
                          background: "#f1f5f9",
                          color: "#475569",
                          padding: "3px 10px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          fontWeight: 600,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {item.slots?.slot_code}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "13px 16px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#0f172a",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.qty.toLocaleString()}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: status.bg,
                          color: status.color,
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: status.dot,
                            display: "inline-block",
                          }}
                        />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #f1f5f9",
            background: "#f8fafc",
            fontSize: "12px",
            color: "#94a3b8",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>最後更新：{new Date().toLocaleString("zh-TW")}</span>
          <span>
            顯示 {filtered.length} / {total} 筆
          </span>
        </div>
      </div>
    </div>
  );
}

export default Inventory;
