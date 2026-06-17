import { useState } from "react";
import { supabase } from "../services/supabase";
import qrcode from "../assets/qrcode.png";

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

    console.log("data=", data);
    console.log("error=", error);

    if (error || data.length === 0) {
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
      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
        }}
      >
        <img
          src={qrcode}
          alt="系統QR Code"
          style={{
            width: "180px",
            height: "180px",
            border: "1px solid red",
          }}
        />

        <p>手機掃描進入系統</p>
      </div>
    </div>
  );
}

export default Login;
