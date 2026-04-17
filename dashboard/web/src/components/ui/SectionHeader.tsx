type SectionHeaderProps = {
  title: string;
  description?: string;
};

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <header style={{ marginBottom: 16 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cf-text-muted)",
        }}
      >
        {title}
      </h2>
      {description ? (
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--cf-text-secondary)", maxWidth: 640 }}>
          {description}
        </p>
      ) : null}
    </header>
  );
}
