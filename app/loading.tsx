export default function Loading() {
  return <div className="kv-shell" style={{ minHeight: "100vh", background: "#f3f5f7" }}>
    <div style={{ position: "sticky", top: 0, zIndex: 70, display: "flex", alignItems: "center", height: 48, padding: "0 16px", background: "#fff", borderBottom: "1px solid #e6ebef", boxShadow: "0 1px 6px rgba(18,42,66,.08)" }}>
      <div className="sk sk-brand" />
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <div className="sk" style={{ width: 32, height: 32, borderRadius: "50%" }} />
        <div className="sk" style={{ width: 32, height: 32, borderRadius: "50%" }} />
        <div className="sk" style={{ width: 32, height: 32, borderRadius: "50%" }} />
      </div>
    </div>
    <div style={{ display: "flex", gap: 10, height: 40, padding: "6px 16px", background: "#fff", borderBottom: "1px solid #e6ebef" }}>
      {Array.from({ length: 7 }, (_, i) => <div key={i} className="sk" style={{ width: 72, height: 22 }} />)}
    </div>
    <div style={{ display: "flex", gap: 13, padding: 16, alignItems: "flex-start" }}>
      <div className="sk" style={{ width: 250, minHeight: 420, borderRadius: 8 }} />
      <div style={{ flex: 1, display: "grid", gap: 10 }}>
        <div className="sk" style={{ height: 40, borderRadius: 8 }} />
        <div className="sk" style={{ height: 300, borderRadius: 8 }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="sk" style={{ width: 180, height: 18 }} />
          <div className="sk" style={{ width: 140, height: 18 }} />
        </div>
      </div>
    </div>
    <style>{`
      .sk{background:linear-gradient(90deg,#eceff3 25%,#f6f8fa 50%,#eceff3 75%);background-size:200% 100%;animation:sk-shimmer 1.3s infinite;border-radius:6px}
      .sk-brand{width:88px;height:26px}
      @keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    `}</style>
  </div>;
}
