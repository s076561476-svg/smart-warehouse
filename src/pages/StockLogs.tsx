import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function StockLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    const { data, error } = await supabase
      .from("stock_logs")
      .select(
        `
        *,
        items (
          name
        )
      `,
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setLogs(data || []);
  }

  const exportToExcel = () => {
    const exportData = logs.map((log) => ({
      時間: new Date(log.created_at).toLocaleString(),
      商品: log.items?.name,
      動作: log.action === "STOCK_IN" ? "入庫" : "出庫",
      數量: log.qty,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "異動紀錄");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(data, `stock_logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <h1>庫存異動紀錄</h1>
      <button
        onClick={exportToExcel}
        style={{
          padding: "10px 20px",
          background: "#16a34a",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        📊 匯出 Excel
      </button>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th>時間</th>
            <th>商品</th>
            <th>動作</th>
            <th>數量</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.created_at).toLocaleString()}</td>

              <td>{log.items?.name}</td>

              <td>{log.action === "STOCK_IN" ? "📦 入庫" : "📤 出庫"}</td>

              <td>{log.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StockLogs;
