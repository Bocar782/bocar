export function BackgroundGlow() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <div className="aurora" />
      <div className="grid-overlay" />
      <div className="grain-overlay" />
    </div>
  );
}
