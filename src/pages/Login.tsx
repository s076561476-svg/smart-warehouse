import { useState } from "react";
import { supabase } from "../services/supabase";

function Login() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("account", account)
      .eq("password", password)
      .single();

    if (error || !data) {
      alert("帳號或密碼錯誤");
      return;
    }

    localStorage.setItem("user", JSON.stringify(data));

    alert("登入成功");

    window.location.href = "/";
  }

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "100px",
      }}
    >
      <h1>智慧倉儲管理系統</h1>

      <br />

      <input
        type="text"
        placeholder="帳號"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="密碼"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br />
      <br />

      <button onClick={login}>登入</button>
    </div>
  );
}

export default Login;
