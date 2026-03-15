export function TopBanner({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="app-banner">
      <div className="app-banner-glow app-banner-glow-left" aria-hidden="true" />
      <div className="app-banner-glow app-banner-glow-right" aria-hidden="true" />
      <p className="eyebrow">Outward crafting helper</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
