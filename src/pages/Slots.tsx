import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Slots() {
  const [slots, setSlots] = useState<any[]>([]);

  useEffect(() => {
    fetchSlots();
  }, []);

  async function fetchSlots() {
    const { data } = await supabase
      .from("slots")
      .select(
        `
      *,
      inventory(
        qty,
        items(
          name
        )
      )
    `,
      )
      .order("slot_code");
    console.log(data);

    setSlots(data || []);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>儲位管理</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "15px",
        }}
      >
        {slots.map((slot) => {
          const stock = slot.inventory?.[0];

          return (
            <div
              key={slot.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "15px",
                textAlign: "center",
                background: stock ? "#e8f5e9" : "#f5f5f5",
              }}
            >
              <h4>{slot.slot_code}</h4>

              {stock ? (
                <>
                  <p>{stock.items?.name}</p>
                  <p>庫存：{stock.qty}</p>
                </>
              ) : (
                <p>空位</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default Slots;
