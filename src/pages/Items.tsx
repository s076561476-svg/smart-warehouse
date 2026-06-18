import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import * as XLSX from "xlsx";

function Items() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [items, setItems] = useState<any[]>([]);

  const [itemName, setItemName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingId, setEditingId] = useState("");
  const [searchText, setSearchText] = useState("");
  const isMobile = window.innerWidth < 768;
  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select(
        `
      *,
      inventory (
  id,
  qty,
  slots (
    slot_code
  )
)
    `,
      )
      .order("name");

    if (error) {
      console.error(error);
      alert("入庫失敗");
      return;
    }

    setItems(data || []);
  }
  async function importExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      const data = event.target?.result;

      const workbook = XLSX.read(data, {
        type: "binary",
      });

      const sheetName = workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];

      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      console.log(rows);

      const itemsToInsert = rows.map((row) => ({
        name: row["商品名稱"],
        sku: row["SKU"],
        barcode: row["條碼"],
      }));

      const { error } = await supabase.from("items").insert(itemsToInsert);

      if (error) {
        console.error(error);
        alert("匯入失敗");
        return;
      }

      alert(`成功匯入 ${itemsToInsert.length} 筆商品`);

      fetchItems();
    };

    reader.readAsBinaryString(file);
  }

  async function addItem() {
    if (!itemName.trim()) {
      alert("請輸入商品名稱");
      return;
    }

    let imageUrl = null;

    // 上傳圖片
    if (imageFile) {
      const fileName = Date.now() + "-" + imageFile.name;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error(uploadError);

        alert("圖片上傳失敗：" + uploadError.message);

        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("products").getPublicUrl(fileName);

      imageUrl = publicUrl;
    }

    const { error } = await supabase.from("items").insert([
      {
        name: itemName,
        sku,
        barcode,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      console.error(error);
      alert("新增失敗");
      return;
    }

    alert("新增成功");

    setItemName("");
    setSku("");
    setBarcode("");
    setImageFile(null);
    setPreviewUrl("");

    fetchItems();
  }
  function editItem(item: any) {
    setEditingId(item.id);

    setItemName(item.name || "");
    setSku(item.sku || "");
    setBarcode(item.barcode || "");

    setPreviewUrl(item.image_url || "");
  }
  async function updateItem() {
    let imageUrl = previewUrl;

    // 如果有重新選圖片
    if (imageFile) {
      const fileName = Date.now() + "-" + imageFile.name;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error(uploadError);

        alert("圖片上傳失敗：" + uploadError.message);

        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("products").getPublicUrl(fileName);

      imageUrl = publicUrl;
    }

    const { error } = await supabase
      .from("items")
      .update({
        name: itemName,
        sku: sku,
        barcode: barcode,
        image_url: imageUrl,
      })
      .eq("id", editingId);

    if (error) {
      console.error(error);
      alert("更新失敗");
      return;
    }

    alert("更新成功");

    setEditingId("");
    setItemName("");
    setSku("");
    setBarcode("");

    setPreviewUrl("");
    setImageFile(null);

    fetchItems();
  }
  async function stockIn(item: any) {
    // 1. 先檢查是否有現有的庫位
    const inventoryList = item.inventory || [];

    let targetInventory;

    if (inventoryList.length > 0) {
      const qty = Number(prompt("請輸入入庫數量"));

      if (!qty || qty <= 0) return;

      targetInventory = inventoryList[0];

      const currentQty = targetInventory.qty || 0;

      const { error } = await supabase
        .from("inventory")
        .update({
          qty: currentQty + qty,
        })
        .eq("id", targetInventory.id);

      if (error) {
        console.error(error);
        alert("入庫失敗");
        return;
      }

      await supabase.from("stock_logs").insert([
        {
          item_id: item.id,
          qty: qty,
          action: "STOCK_IN",
        },
      ]);

      alert("入庫成功");
      fetchItems();
      return;
    } else {
      // --- 重點：如果沒有庫位，這裡可以改成「建立新庫位」的邏輯 ---
      const newSlotCode = prompt("請輸入庫位編號 (例如 A-01-01)");

      if (!newSlotCode) return;

      const qty = Number(prompt("請輸入入庫數量"));

      if (!qty || qty <= 0) return;

      // 在這裡加入 Supabase Insert 邏輯來建立新的 inventory 紀錄
      // ... (新增庫位的程式碼)
      const { data: slot } = await supabase
        .from("slots")
        .select("*")
        .eq("slot_code", newSlotCode)
        .single();
      if (!slot) {
        alert("庫位不存在");
        return;
      }

      const { error } = await supabase.from("inventory").insert([
        {
          item_id: item.id,
          slot_id: slot.id,
          qty: qty,
        },
      ]);

      if (error) {
        console.error(error);
        alert("建立庫存失敗");
        return;
      }

      alert("入庫成功");
      fetchItems();
      return;
    }
  }

  async function stockOut(item: any) {
    const qty = Number(prompt("出庫數量"));

    if (!qty || qty <= 0) return;

    const currentQty = item.inventory?.[0]?.qty || 0;

    if (qty > currentQty) {
      alert("庫存不足");
      return;
    }

    const inventoryId = item.inventory?.[0]?.id;

    const { error } = await supabase
      .from("inventory")
      .update({
        qty: currentQty - qty,
      })
      .eq("id", inventoryId);

    if (error) {
      console.error(error);
      alert("出庫失敗");
      return;
    }

    await supabase.from("stock_logs").insert([
      {
        item_id: item.id,
        qty: qty,
        action: "STOCK_OUT",
      },
    ]);

    fetchItems();
  }

  async function deleteItem(id: string) {
    const ok = confirm("確定要刪除商品嗎？");

    if (!ok) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("刪除失敗");
      return;
    }

    fetchItems();
  }

  // --- 以下為重新排版後的 UI 部分 ---
  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f4f7f9",
        minHeight: "100vh",
        fontFamily: "'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#fff",
          padding: "30px",
          borderRadius: "8px",
          boxShadow: "0 2px 15px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ color: "#888", fontSize: "14px", margin: "0" }}>
            WAREHOUSE MANAGEMENT SYSTEM
          </h2>
          <h1 style={{ color: "#333", fontSize: "28px", margin: "5px 0 0 0" }}>
            商品管理
          </h1>
        </div>

        {/* 第一張圖的頂部數據統計 (Dashboard) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
            gap: "20px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#666", fontSize: "14px" }}>商品總數</div>
            <div
              style={{ color: "#007bff", fontSize: "32px", fontWeight: "bold" }}
            >
              {items.length}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#666", fontSize: "14px" }}>庫存告警</div>
            <div
              style={{ color: "#ffc107", fontSize: "32px", fontWeight: "bold" }}
            >
              {items.filter((i) => (i.inventory?.[0]?.qty || 0) < 20).length}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#666", fontSize: "14px" }}>庫存偏低</div>
            <div
              style={{ color: "#fd7e14", fontSize: "32px", fontWeight: "bold" }}
            >
              {
                items.filter(
                  (i) =>
                    (i.inventory?.[0]?.qty || 0) > 0 &&
                    (i.inventory?.[0]?.qty || 0) < 20,
                ).length
              }
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#666", fontSize: "14px" }}>缺貨</div>
            <div
              style={{ color: "#dc3545", fontSize: "32px", fontWeight: "bold" }}
            >
              {items.filter((i) => (i.inventory?.[0]?.qty || 0) === 0).length}
            </div>
          </div>
        </div>

        {/* 第二張圖的輸入表單區塊 */}
        <div
          style={{
            padding: "25px",
            border: "1px solid #eee",
            borderRadius: "8px",
            backgroundColor: "#fafafa",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
              gap: "20px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{ fontSize: "13px", fontWeight: "bold", color: "#555" }}
              >
                🔍 搜尋商品
              </label>
              <input
                type="text"
                placeholder="輸入名稱搜尋..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{ fontSize: "13px", fontWeight: "bold", color: "#555" }}
              >
                商品名稱
              </label>
              <input
                type="text"
                placeholder="請輸入商品名稱"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{ fontSize: "13px", fontWeight: "bold", color: "#555" }}
              >
                SKU 編號
              </label>
              <input
                type="text"
                placeholder="請輸入SKU"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{ fontSize: "13px", fontWeight: "bold", color: "#555" }}
              >
                條碼
              </label>
              <input
                type="text"
                placeholder="請輸入條碼"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>
          </div>

          {/* 按鈕區塊 */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <button
              onClick={() => document.getElementById("image-upload")?.click()}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
                backgroundColor: "#8c8c8c",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              📷 上傳圖片
            </button>

            <input
              id="image-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  const file = e.target.files[0];
                  setImageFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
              }}
            />

            {currentUser.role === "admin" && (
              <button
                onClick={() => document.getElementById("excel-upload")?.click()}
                style={{
                  padding: "10px 20px",
                  cursor: "pointer",
                  backgroundColor: "#00a8e8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                📥 Excel匯入
              </button>
            )}

            <input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={importExcel}
            />

            {currentUser.role === "admin" && (
              <button
                onClick={editingId ? updateItem : addItem}
                style={{
                  padding: "10px 30px",
                  cursor: "pointer",
                  backgroundColor: editingId ? "#ffc107" : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                }}
              >
                {editingId ? "💾 更新商品" : "➕ 新增商品"}
              </button>
            )}
          </div>
        </div>

        <hr
          style={{ border: "0", borderTop: "1px solid #eee", margin: "20px 0" }}
        />

        {/* 第一張圖的表格樣式 */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8f9fa", color: "#4a5568" }}>
                <th style={thStyle}>序號</th>
                <th style={thStyle}>商品名稱</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>條碼</th>
                <th style={thStyle}>庫位</th>
                <th style={thStyle}>庫存數量</th>
                <th style={thStyle}>狀態</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>{String(index + 1).padStart(3, "0")}</td>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>{item.sku}</td>
                  <td style={tdStyle}>{item.barcode}</td>
                  <td style={tdStyle}>
                    {item.inventory?.[0]?.slots?.slot_code || "-"}
                  </td>
                  <td style={tdStyle}>{item.inventory?.[0]?.qty || 0}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        border: "1px solid #ddd",
                      }}
                    >
                      {(item.inventory?.[0]?.qty || 0) === 0
                        ? "🔴缺貨"
                        : (item.inventory?.[0]?.qty || 0) < 20
                          ? "🟠偏低"
                          : "🟢正常"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => stockIn(item)}
                        style={btnActionStyle}
                      >
                        入庫
                      </button>
                      <button
                        onClick={() => stockOut(item)}
                        style={{
                          ...btnActionStyle,
                          backgroundColor: "#dc3545",
                        }}
                      >
                        出庫
                      </button>
                      {currentUser.role === "admin" && (
                        <>
                          <button
                            onClick={() => editItem(item)}
                            style={{
                              ...btnActionStyle,
                              backgroundColor: "#0d6efd",
                            }}
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            style={{
                              ...btnActionStyle,
                              backgroundColor: "#6c757d",
                            }}
                          >
                            刪除
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: "20px",
            color: "#999",
            fontSize: "12px",
            textAlign: "right",
          }}
        >
          最後更新：{new Date().toLocaleString()} | 頁碼 1 /{" "}
          {Math.ceil(items.length / 10)}
        </div>
      </div>
    </div>
  );
}

// 樣式定義
const thStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "left",
  fontWeight: "bold",
  borderBottom: "2px solid #eee",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  color: "#333",
  fontSize: "14px",
};

const btnActionStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "12px",
  cursor: "pointer",
  border: "none",
  borderRadius: "4px",
  color: "white",
  backgroundColor: "#28a745",
};

export default Items;
