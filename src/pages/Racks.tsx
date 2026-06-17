import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Racks() {
  // =========================
  // 貨架列表
  // =========================
  const [racks, setRacks] = useState<any[]>([]);

  // =========================
  // 新貨架名稱
  // =========================
  const [rackCode, setRackCode] = useState("");

  // =========================
  // 頁面載入
  // =========================
  useEffect(() => {
    fetchRacks();
  }, []);

  // =========================
  // 讀取貨架資料
  // =========================
  async function fetchRacks() {
    const { data, error } = await supabase.from("racks").select("*");

    console.log("Rack資料:", data);

    if (error) {
      console.error(error);
      return;
    }

    setRacks(data || []);
  }

  // =========================
  // 新增貨架
  // =========================
  async function addRack() {
    if (!rackCode.trim()) {
      alert("請輸入貨架編號");
      return;
    }

    const { error } = await supabase.from("racks").insert([
      {
        rack_code: rackCode,
      },
    ]);

    if (error) {
      console.error(error);
      return;
    }

    setRackCode("");

    fetchRacks();
  }

  return (
    <div>
      <h1>貨架管理</h1>

      {/* 新增貨架 */}

      <input
        type="text"
        placeholder="請輸入貨架編號"
        value={rackCode}
        onChange={(e) => setRackCode(e.target.value)}
      />

      <button onClick={addRack} style={{ marginLeft: "10px" }}>
        新增貨架
      </button>

      <hr />

      {/* 貨架列表 */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 200px)",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        {racks.map((rack) => (
          <div
            key={rack.id}
            style={{
              border: "3px solid #2563eb",
              borderRadius: "10px",
              padding: "40px",
              textAlign: "center",
              fontSize: "24px",
              fontWeight: "bold",
              backgroundColor: "#eff6ff",
            }}
          >
            {rack.rack_code}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Racks;
