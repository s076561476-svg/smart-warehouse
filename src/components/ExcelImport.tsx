import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../services/supabase";

// =========================
// Excel 每列資料型別
// =========================
type ExcelRow = {
  商品名稱?: string;
  儲位編號?: string;
  數量?: number | string;
};

function ExcelImport() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      // =========================
      // 1. 讀取 Excel 檔案
      // =========================
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 把 Excel 轉成 JSON
      const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData.length) {
        alert("Excel 沒有資料");
        setLoading(false);
        return;
      }

      // 匯入結果統計
      let successCount = 0;
      let failCount = 0;
      const failMessages: string[] = [];

      // =========================
      // 2. 一列一列處理 Excel 資料
      // =========================
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        const itemName = String(row["商品名稱"] || "").trim();
        const slotCode = String(row["儲位編號"] || "").trim();
        const qty = Number(row["數量"] || 0);

        // 基本檢查
        if (!itemName || !slotCode || qty <= 0) {
          failCount++;
          failMessages.push(
            `第 ${i + 2} 列資料不完整：商品名稱 / 儲位編號 / 數量 必須正確`,
          );
          continue;
        }

        try {
          // =========================
          // 3. 查商品是否存在
          // =========================
          let itemId = "";

          const { data: existingItem, error: itemFindError } = await supabase
            .from("items")
            .select("id, name")
            .eq("name", itemName)
            .maybeSingle();

          if (itemFindError) {
            throw new Error(`查詢商品失敗：${itemFindError.message}`);
          }

          if (existingItem) {
            // 商品已存在
            itemId = existingItem.id;
          } else {
            // =========================
            // 4. 商品不存在 -> 建立商品
            // =========================
            const { data: newItem, error: insertItemError } = await supabase
              .from("items")
              .insert([
                {
                  name: itemName,
                },
              ])
              .select()
              .single();

            if (insertItemError || !newItem) {
              throw new Error(
                `建立商品失敗：${insertItemError?.message || "未知錯誤"}`,
              );
            }

            itemId = newItem.id;
          }

          // =========================
          // 5. 查儲位 slot_code
          // =========================
          const { data: slotData, error: slotError } = await supabase
            .from("slots")
            .select("id, slot_code")
            .eq("slot_code", slotCode)
            .maybeSingle();

          if (slotError) {
            throw new Error(`查詢儲位失敗：${slotError.message}`);
          }

          if (!slotData) {
            throw new Error(`找不到儲位：${slotCode}`);
          }

          const slotId = slotData.id;

          // =========================
          // 6. 查 inventory 是否已存在
          //    條件：同商品 + 同儲位
          // =========================
          const { data: existingInventory, error: inventoryFindError } =
            await supabase
              .from("inventory")
              .select("id, qty")
              .eq("item_id", itemId)
              .eq("slot_id", slotId)
              .maybeSingle();

          if (inventoryFindError) {
            throw new Error(`查詢庫存失敗：${inventoryFindError.message}`);
          }

          if (existingInventory) {
            // =========================
            // 7A. 已存在 -> 更新數量
            // 這裡先用「覆蓋數量」
            // =========================
            const { error: updateError } = await supabase
              .from("inventory")
              .update({
                qty: qty,
              })
              .eq("id", existingInventory.id);

            if (updateError) {
              throw new Error(`更新庫存失敗：${updateError.message}`);
            }
          } else {
            // =========================
            // 7B. 不存在 -> 新增庫存
            // =========================
            const { error: insertInventoryError } = await supabase
              .from("inventory")
              .insert([
                {
                  item_id: itemId,
                  slot_id: slotId,
                  qty: qty,
                },
              ]);

            if (insertInventoryError) {
              throw new Error(`新增庫存失敗：${insertInventoryError.message}`);
            }
          }

          successCount++;
        } catch (rowError: any) {
          failCount++;
          failMessages.push(`第 ${i + 2} 列失敗：${rowError.message}`);
        }
      }

      // =========================
      // 8. 顯示匯入結果
      // =========================
      let resultMessage = `匯入完成！成功 ${successCount} 筆，失敗 ${failCount} 筆`;

      if (failMessages.length > 0) {
        resultMessage += "\n\n失敗原因：\n" + failMessages.join("\n");
      }

      setMessage(resultMessage);
      alert(resultMessage);
    } catch (error: any) {
      console.error(error);
      alert("Excel 匯入失敗：" + error.message);
      setMessage("Excel 匯入失敗：" + error.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div
      style={{
        background: "white",
        padding: "20px",
        borderRadius: "16px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        marginBottom: "20px",
      }}
    >
      <h2>Excel 匯入商品 / 庫存</h2>
      <p style={{ color: "#64748b", lineHeight: 1.8 }}>
        Excel 欄位格式請使用：
        <br />
        <b>商品名稱 / 儲位編號 / 數量</b>
      </p>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        disabled={loading}
      />

      {loading && (
        <p style={{ marginTop: "12px", color: "#2563eb" }}>匯入中，請稍候...</p>
      )}

      {message && (
        <pre
          style={{
            marginTop: "16px",
            whiteSpace: "pre-wrap",
            background: "#f8fafc",
            padding: "12px",
            borderRadius: "12px",
            fontSize: "14px",
          }}
        >
          {message}
        </pre>
      )}
    </div>
  );
}

export default ExcelImport;
