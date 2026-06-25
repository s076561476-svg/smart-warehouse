import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../services/supabase";

type ExcelImportProps = {
  onImportSuccess?: () => void;
};

type ExcelRow = {
  商品名稱?: string;
  儲位編號?: string;
  數量?: string | number;
};

function ExcelImport({ onImportSuccess }: ExcelImportProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      // =========================
      // 1. 讀取 Excel
      // =========================
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

      if (!jsonData || jsonData.length === 0) {
        alert("Excel 沒有資料");
        setLoading(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failMessages: string[] = [];

      // =========================
      // 2. 一列一列匯入
      // =========================
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        const itemName = String(row["商品名稱"] || "").trim();
        const slotCode = String(row["儲位編號"] || "").trim();
        const qtyValue = row["數量"];
        const qty =
          qtyValue === undefined || qtyValue === null || qtyValue === ""
            ? NaN
            : Number(qtyValue);

        // 商品名稱 / 儲位編號 / 數量 都必填
        if (!itemName || !slotCode || Number.isNaN(qty)) {
          failCount++;
          failMessages.push(
            `第 ${i + 2} 列資料不完整（需要：商品名稱 / 儲位編號 / 數量）`,
          );
          continue;
        }

        try {
          // =========================
          // 3. 先找商品
          // 沒有就建立商品
          // =========================
          let itemId = "";

          const { data: existingItem, error: itemError } = await supabase
            .from("items")
            .select("id, name")
            .eq("name", itemName)
            .maybeSingle();

          if (itemError) {
            throw new Error(`查詢商品失敗：${itemError.message}`);
          }

          if (existingItem) {
            itemId = existingItem.id;
          } else {
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
                `新增商品失敗：${insertItemError?.message || "未知錯誤"}`,
              );
            }

            itemId = newItem.id;
          }

          // =========================
          // 4. 找儲位
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
          // 5. 查 inventory 是否已存在
          // 同一商品 + 同一儲位
          // =========================
          const { data: existingInventory, error: inventoryError } =
            await supabase
              .from("inventory")
              .select("id, qty")
              .eq("item_id", itemId)
              .eq("slot_id", slotId)
              .maybeSingle();

          if (inventoryError) {
            throw new Error(`查詢庫存失敗：${inventoryError.message}`);
          }

          if (existingInventory) {
            // 已有資料 → 更新數量
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
            // 沒有資料 → 新增
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
      // 6. 匯入結果
      // =========================
      let result = `匯入完成：成功 ${successCount} 筆，失敗 ${failCount} 筆`;

      if (failMessages.length > 0) {
        result += "\n\n失敗原因：\n" + failMessages.join("\n");
      }

      setMessage(result);
      alert(result);

      // 通知 Items 頁面刷新
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = `Excel 匯入失敗：${error.message}`;
      setMessage(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "20px",
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Excel 匯入商品 / 庫存</h3>

      <div
        style={{
          background: "#f8fafc",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          lineHeight: 1.8,
          color: "#475569",
        }}
      >
        <div>Excel 欄位請使用：</div>
        <strong>商品名稱 / 儲位編號 / 數量</strong>
        <div style={{ marginTop: "6px" }}>範例：RTX 5070 OC / A-01-01 / 80</div>
      </div>

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
            borderRadius: "10px",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          {message}
        </pre>
      )}
    </div>
  );
}

export default ExcelImport;
