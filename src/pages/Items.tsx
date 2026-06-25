import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import ExcelImport from "../components/ExcelImport";

function Items() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data } = await supabase.from("items").select("*");
    setItems(data || []);
  }

  return (
    <div style={{ padding: "30px" }}>
      <h1>商品管理</h1>

      {/* Excel 匯入區 */}
      <ExcelImport />

      {/* 原本商品列表 / 新增商品表單 */}
      <div>
        {items.map((item) => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>
    </div>
  );
}

export default Items;
