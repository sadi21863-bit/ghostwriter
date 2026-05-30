type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--color-text-primary)", margin: "0 0 8px" }}>{title}</h3>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, maxWidth: 320, marginBottom: action ? 24 : 0, lineHeight: 1.6 }}>
        {description}
      </p>
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 24, padding: "10px 24px", borderRadius: 8,
          background: "var(--color-accent)", color: "white",
          border: "none", cursor: "pointer", fontWeight: 500, fontSize: 14,
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
