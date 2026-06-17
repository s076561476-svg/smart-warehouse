import { Routes, Route, Link, Navigate } from "react-router-dom";
import Items from "./pages/Items";
import Inventory from "./pages/Inventory";
import StockIn from "./pages/StockIn";
import StockLogs from "./pages/StockLogs";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Slots from "./pages/Slots";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = localStorage.getItem("user");
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const user = localStorage.getItem("user");

  const currentUser = JSON.parse(user || "{}");
  console.log(currentUser);

  return (
    <div>
      {user && (
        <nav
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 24px",
            height: "56px",
            background: "#0f172a",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <span
              style={{
                color: "#38bdf8",
                fontWeight: 600,
                fontSize: "15px",
                letterSpacing: "0.5px",
              }}
            >
              智慧倉儲
            </span>
            <div
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {[
                { to: "/", label: "Dashboard" },
                { to: "/items", label: "商品管理" },
                { to: "/inventory", label: "庫存查詢" },
                { to: "/stockin", label: "庫存異動" },
                { to: "/logs", label: "異動紀錄" },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    color: "#94a3b8",
                    textDecoration: "none",
                    fontSize: "14px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = "#1e293b";
                    (e.target as HTMLElement).style.color = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = "transparent";
                    (e.target as HTMLElement).style.color = "#94a3b8";
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "#1e40af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#bfdbfe",
                }}
              >
                {currentUser.display_name?.charAt(0)}
              </div>
              <span
                style={{
                  color: "#cbd5e1",
                  fontSize: "14px",
                }}
              >
                {currentUser.display_name}
              </span>
            </div>

            <div
              style={{ width: "1px", height: "20px", background: "#334155" }}
            />

            <button
              onClick={() => {
                localStorage.removeItem("user");
                window.location.href = "/login";
              }}
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #334155",
                padding: "5px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#ef4444";
                (e.currentTarget as HTMLElement).style.color = "#fff";
                (e.currentTarget as HTMLElement).style.borderColor = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                (e.currentTarget as HTMLElement).style.borderColor = "#334155";
              }}
            >
              登出
            </button>
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/items"
          element={
            <ProtectedRoute>
              <Items />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stockin"
          element={
            <ProtectedRoute>
              <StockIn />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute>
              <StockLogs />
            </ProtectedRoute>
          }
        />
        <Route path="/slots" element={<Slots />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;
