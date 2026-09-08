export default function KlyxSocialCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#ffffff",
        color: "#09090b",
        padding: "72px 84px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 112,
            height: 112,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 30,
            background: "#09090b",
          }}
        >
          <svg width="86" height="86" viewBox="0 0 40 40">
            <path
              d="M10 7v26h6V22.8L26.5 33H35L21.6 19.7 34 7h-8.1L16 17.4V7H10Z"
              fill="#ffffff"
            />
            <path
              d="M25.8 7 20 13l4.1 4.1L34 7h-8.2Z"
              fill="#2563EB"
            />
          </svg>
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: 28,
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: "-2px",
          }}
        >
          KLYX
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            maxWidth: 920,
            fontSize: 72,
            lineHeight: 1.02,
            fontWeight: 900,
            letterSpacing: "-4px",
          }}
        >
          Tous vos services, simplement.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            color: "#52525b",
          }}
        >
          Trouvez, réservez et payez des prestataires de confiance.
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: 16,
          display: "flex",
          borderRadius: 999,
          background: "#2563EB",
        }}
      />
    </div>
  );
}
