import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import * as XLSX from "xlsx";

type Item = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
};

function Items() {
  /* =========================
     基本 state
  ========================= */
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  /* =========================
     表單 state
  ========================= */
  const [itemName, setItemName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  /* =========================
     編輯模式
  ========================= */
  const [editingId, setEditingId] = useState<string | null>(null);

  /* =========================
     搜尋
  ========================= */
  const [searchText, setSearchText] = useState("");

  /* =========================
     Excel 匯入 input
  ========================= */
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isMobile = window.innerWidth < 768;

  /* =========================
     初始載入
  ========================= */
  useEffect(() => {
    fetchItems();
  }, []);

  /* =========================
     讀取商品
  ========================= */
  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select("id, name, sku, barcode, image_url")
      .order("id", { ascending: false });

    if (error) {
      console.error("讀取商品失敗：", error);
      alert("讀取商品失敗");
      setLoading(false);
      return;
    }

    setItems((data as Item[]) || []);
    setLoading(false);
  }

  /* =========================
     清空表單
  ========================= */
  function resetForm() {
    setItemName("");
    setSku("");
    setBarcode("");
    setImageUrl("");
    setEditingId(null);
  }

  /* =========================
     新增 / 更新商品
  ========================= */
  async function addOrUpdateItem() {
    const name = itemName.trim();
    const finalSku = sku.trim();
    const finalBarcode = barcode.trim();
    const finalImageUrl = imageUrl.trim();

    if (!name) {
      alert("請輸入商品名稱");
      return;
    }

    // 編輯模式
    if (editingId) {
      const { error } = await supabase
        .from("items")
        .update({
          name,
          sku: finalSku || null,
          barcode: finalBarcode || null,
          image_url: finalImageUrl || null,
        })
        .eq("id", editingId);

      if (error) {
        console.error("更新商品失敗：", error);
        alert("更新商品失敗");
        return;
      }

      alert("商品更新成功");
      resetForm();
      fetchItems();
      return;
    }

    // 新增前：若 SKU 有填，先檢查是否重複
    if (finalSku) {
      const { data: existingSku } = await supabase
        .from("items")
        .select("id")
        .eq("sku", finalSku)
        .maybeSingle();

      if (existingSku) {
        alert("此 SKU 已存在，請改用編輯或更換 SKU");
        return;
      }
    }

    // 名稱重複提醒（不擋，只提醒）
    const { data: sameNameItem } = await supabase
      .from("items")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (sameNameItem) {
      const confirmAdd = window.confirm(
        `已存在同名商品「${name}」，仍要繼續新增嗎？`,
      );
      if (!confirmAdd) return;
    }

    const { error } = await supabase.from("items").insert([
      {
        name,
        sku: finalSku || null,
        barcode: finalBarcode || null,
        image_url: finalImageUrl || null,
      },
    ]);

    if (error) {
      console.error("新增商品失敗：", error);
      alert("新增商品失敗");
      return;
    }

    alert("商品新增成功");
    resetForm();
    fetchItems();
  }

  /* =========================
     點擊編輯
  ========================= */
  function startEdit(item: Item) {
    setEditingId(item.id);
    setItemName(item.name || "");
    setSku(item.sku || "");
    setBarcode(item.barcode || "");
    setImageUrl(item.image_url || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================
     刪除商品
  ========================= */
  async function deleteItem(id: string, name: string) {
    const ok = window.confirm(`確定要刪除商品「${name}」嗎？`);
    if (!ok) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) {
      console.error("刪除商品失敗：", error);
      alert("刪除商品失敗");
      return;
    }

    alert("商品已刪除");
    fetchItems();
  }

  /* =========================
     Excel 匯入
     規則：
     1. 空白名稱不匯入
     2. 有 SKU → 優先用 SKU 找舊資料
     3. 沒 SKU → 用商品名稱找舊資料
     4. 找到舊資料就更新，找不到就新增
  ========================= */
  async function importExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (!rows.length) {
        alert("Excel 沒有資料");
        return;
      }

      // 整理資料：空白名稱直接過濾掉
      const normalizedRows = rows
        .map((row) => ({
          name: String(row["商品名稱"] || "").trim(),
          sku: String(row["SKU"] || "").trim(),
          barcode: String(row["條碼"] || "").trim(),
          image_url: String(row["圖片網址"] || "").trim(),
        }))
        .filter((row) => row.name !== "");

      if (normalizedRows.length === 0) {
        alert("Excel 裡沒有可匯入的商品名稱");
        return;
      }

      // 先抓現有商品，避免每列都打資料庫
      const { data: existingItems, error: fetchError } = await supabase
        .from("items")
        .select("id, name, sku, barcode, image_url");

      if (fetchError) {
        console.error("讀取既有商品失敗：", fetchError);
        alert("讀取既有商品失敗");
        return;
      }

      const existing = (existingItems as Item[]) || [];

      const updates: {
        id: string;
        name: string;
        sku: string | null;
        barcode: string | null;
        image_url: string | null;
      }[] = [];

      const inserts: {
        name: string;
        sku: string | null;
        barcode: string | null;
        image_url: string | null;
      }[] = [];

      for (const row of normalizedRows) {
        // 比對規則：
        // 1. 有 SKU → 用 SKU 找
        // 2. 沒 SKU → 用 name 找
        let matchedItem: Item | undefined;

        if (row.sku) {
          matchedItem = existing.find(
            (item) => (item.sku || "").trim() === row.sku,
          );
        } else {
          matchedItem = existing.find(
            (item) => (item.name || "").trim() === row.name,
          );
        }

        if (matchedItem) {
          // 更新成 Excel 的資料為主
          updates.push({
            id: matchedItem.id,
            name: row.name,
            sku: row.sku || null,
            barcode: row.barcode || null,
            image_url: row.image_url || null,
          });
        } else {
          inserts.push({
            name: row.name,
            sku: row.sku || null,
            barcode: row.barcode || null,
            image_url: row.image_url || null,
          });
        }
      }

      // 先跑更新
      for (const row of updates) {
        const { error } = await supabase
          .from("items")
          .update({
            name: row.name,
            sku: row.sku,
            barcode: row.barcode,
            image_url: row.image_url,
          })
          .eq("id", row.id);

        if (error) {
          console.error("更新 Excel 商品失敗：", row, error);
        }
      }

      // 再跑新增
      if (inserts.length > 0) {
        const { error } = await supabase.from("items").insert(inserts);

        if (error) {
          console.error("新增 Excel 商品失敗：", error);
          alert("Excel 匯入失敗");
          return;
        }
      }

      alert(
        `Excel 匯入完成：更新 ${updates.length} 筆，新增 ${inserts.length} 筆`,
      );

      // 清空 input，避免選同一個檔案時不觸發 onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      fetchItems();
    } catch (err) {
      console.error("Excel 解析失敗：", err);
      alert("Excel 解析失敗，請確認欄位名稱是否正確");
    }
  }

  /* =========================
     搜尋過濾
  ========================= */
  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const skuText = (item.sku || "").toLowerCase();
      const barcodeText = (item.barcode || "").toLowerCase();

      return (
        name.includes(keyword) ||
        skuText.includes(keyword) ||
        barcodeText.includes(keyword)
      );
    });
  }, [items, searchText]);

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
        商品管理
      </h1>

      {/* =========================
          上方：新增 / 編輯商品卡片
      ========================= */}
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "24px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "18px", color: "#334155" }}>
          {editingId ? "編輯商品" : "新增商品"}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          <div>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>商品名稱</p>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="例如：紙板 / 膠帶 / RTX 5070 OC"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>SKU</p>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="例如：CB001"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>條碼</p>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="例如：4712345678901"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>圖片網址</p>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* 圖片預覽 */}
        {imageUrl.trim() && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>圖片預覽</p>
            <img
              src={imageUrl}
              alt="商品預覽"
              style={{
                width: "180px",
                height: "180px",
                objectFit: "cover",
                borderRadius: "14px",
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            />
          </div>
        )}

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <button
            onClick={addOrUpdateItem}
            style={{
              background: editingId ? "#f59e0b" : "#2563eb",
              color: "#fff",
              border: "none",
              padding: "12px 20px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {editingId ? "更新商品" : "新增商品"}
          </button>

          {editingId && (
            <button
              onClick={resetForm}
              style={{
                background: "#64748b",
                color: "#fff",
                border: "none",
                padding: "12px 20px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              取消編輯
            </button>
          )}
        </div>
      </div>

      {/* =========================
          Excel 匯入 + 搜尋
      ========================= */}
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "18px", color: "#334155" }}>
          商品工具
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "16px",
          }}
        >
          {/* 搜尋 */}
          <div>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>
              搜尋商品（名稱 / SKU / 條碼）
            </p>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="輸入關鍵字搜尋..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Excel 匯入 */}
          <div>
            <p style={{ marginBottom: "8px", fontWeight: 600 }}>
              Excel 匯入商品
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={importExcel}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                boxSizing: "border-box",
              }}
            />
            <p style={{ marginTop: "8px", color: "#64748b", fontSize: "13px" }}>
              Excel 欄位建議：商品名稱 / SKU / 條碼 / 圖片網址
            </p>
          </div>
        </div>
      </div>

      {/* =========================
          商品列表
      ========================= */}
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h2 style={{ margin: 0, color: "#334155" }}>商品列表</h2>
          <span style={{ color: "#64748b" }}>共 {filteredItems.length} 筆</span>
        </div>

        {loading ? (
          <p>讀取中...</p>
        ) : filteredItems.length === 0 ? (
          <p style={{ color: "#64748b" }}>目前沒有符合條件的商品</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
              gap: "16px",
            }}
          >
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "#f8fafc",
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                }}
              >
                {/* 左：圖片 */}
                <div
                  style={{
                    width: "92px",
                    minWidth: "92px",
                    height: "92px",
                    borderRadius: "14px",
                    overflow: "hidden",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                      無圖片
                    </span>
                  )}
                </div>

                {/* 右：資訊 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#1e293b",
                      marginBottom: "10px",
                      wordBreak: "break-word",
                    }}
                  >
                    {item.name || "未命名商品"}
                  </div>

                  <div style={{ color: "#64748b", fontSize: "14px" }}>
                    <div style={{ marginBottom: "6px" }}>
                      SKU：{item.sku || "-"}
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      條碼：{item.barcode || "-"}
                    </div>
                    <div>ID：{item.id}</div>
                  </div>

                  <div
                    style={{
                      marginTop: "14px",
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => startEdit(item)}
                      style={{
                        background: "#f59e0b",
                        color: "#fff",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      編輯
                    </button>

                    <button
                      onClick={() => deleteItem(item.id, item.name)}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Items;
