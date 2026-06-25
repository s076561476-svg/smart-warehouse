import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import ExcelImport from "../components/ExcelImport";

type Item = {
  id: string;
  name: string | null;
  sku?: string | null;
  barcode?: string | null;
  image_url?: string | null;
};

function Items() {
  const [items, setItems] = useState<Item[]>([]);

  // 新增商品欄位
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // 搜尋
  const [search, setSearch] = useState("");

  // Excel 區塊開關
  const [showExcel, setShowExcel] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("讀取商品失敗：", error);
      return;
    }

    setItems((data as Item[]) || []);
  }

  async function addItem() {
    if (!name.trim()) {
      alert("請輸入商品名稱");
      return;
    }

    // 檢查是否已有同名商品
    const { data: existingItem, error: checkError } = await supabase
      .from("items")
      .select("id")
      .eq("name", name.trim())
      .maybeSingle();

    if (checkError) {
      console.error(checkError);
      alert("檢查商品失敗：" + checkError.message);
      return;
    }

    if (existingItem) {
      alert("商品已存在");
      return;
    }

    const { error } = await supabase.from("items").insert([
      {
        name: name.trim(),
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        image_url: imageUrl.trim() || null,
      },
    ]);

    if (error) {
      console.error(error);
      alert("新增商品失敗：" + error.message);
      return;
    }

    alert("新增商品成功");
    setName("");
    setSku("");
    setBarcode("");
    setImageUrl("");
    fetchItems();
  }

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const itemName = item.name?.toLowerCase() || "";
      const itemSku = item.sku?.toLowerCase() || "";
      const itemBarcode = item.barcode?.toLowerCase() || "";

      return (
        itemName.includes(keyword) ||
        itemSku.includes(keyword) ||
        itemBarcode.includes(keyword)
      );
    });
  }, [items, search]);

  return (
    <div style={{ padding: "30px" }}>
      <h1 style={{ marginBottom: "20px" }}>商品管理</h1>

      {/* =========================
          新增商品
      ========================= */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>新增商品</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <div>
            <p>商品名稱</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：紙板 / 膠帶 / RTX 5070 OC"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p>SKU</p>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="例如：CB001"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p>條碼</p>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="例如：4712345678901"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p>圖片網址</p>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <button
          onClick={addItem}
          style={{
            marginTop: "18px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "10px 18px",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          新增商品
        </button>
      </div>

      {/* =========================
          商品工具
      ========================= */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>商品工具</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div>
            <p>搜尋商品（名稱 / SKU / 條碼）</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="輸入關鍵字搜尋..."
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ alignSelf: "end" }}>
            <button
              onClick={() => setShowExcel((prev) => !prev)}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showExcel ? "收起 Excel 匯入" : "Excel 匯入商品"}
            </button>
          </div>
        </div>

        {showExcel && <ExcelImport onImportSuccess={fetchItems} />}
      </div>

      {/* =========================
          商品列表
      ========================= */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>商品列表</h2>

        {filteredItems.length === 0 ? (
          <p>目前沒有商品資料</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "#fafafa",
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name || "商品圖片"}
                    style={{
                      width: "100%",
                      height: "160px",
                      objectFit: "cover",
                      borderRadius: "10px",
                      marginBottom: "12px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "160px",
                      borderRadius: "10px",
                      marginBottom: "12px",
                      background: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                    }}
                  >
                    無圖片
                  </div>
                )}

                <h3 style={{ margin: "0 0 10px 0" }}>
                  {item.name || "未命名商品"}
                </h3>

                <p style={{ margin: "6px 0", color: "#475569" }}>
                  SKU：{item.sku || "-"}
                </p>

                <p style={{ margin: "6px 0", color: "#475569" }}>
                  條碼：{item.barcode || "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Items;
