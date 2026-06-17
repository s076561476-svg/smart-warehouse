import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Zones() {

  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    fetchZones();
  }, []);

  async function fetchZones() {

    const { data, error } = await supabase
      .from("zones")
      .select("*");

     console.log("Zones資料:", data);
     console.log("Error:", error);

    if (error) {
      console.error(error);
      return;
    }

    setZones(data || []);
  }

  return (
    <div>

      <h1>區域管理</h1>

       {zones.map((zone) => (
        <div
          key={zone.id}
          style={{
            padding: "10px",
            marginBottom: "10px",
            border: "1px solid #ccc",
          }}
        >
          {zone.name}
        </div>
      ))}

    </div>
  );
}

export default Zones;