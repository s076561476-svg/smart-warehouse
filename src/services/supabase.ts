// 引入 Supabase 套件
import { createClient } from "@supabase/supabase-js";

// =========================
// Supabase 專案設定
// =========================

// 從 .env 讀取網址
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

// 從 .env 讀取 API Key
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// =========================
// 建立 Supabase 連線
// =========================

export const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );