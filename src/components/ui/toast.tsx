let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement("div");
    container.style.cssText =
      "position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:min(420px,calc(100% - 32px))";
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: "error" | "success" | "info" = "error") {
  const el = document.createElement("div");
  const colors =
    type === "error"
      ? "bg-spore-500 text-white border-spore-600"
      : type === "success"
        ? "bg-verdant-500 text-white border-verdant-600"
        : "bg-ink-900 text-paper border-ink-800";

  el.className = colors;
  el.style.cssText = `
    pointer-events:auto;
    display:flex;align-items:center;gap:10px;
    padding:12px 20px;
    border-radius:12px;
    border:1px solid;
    font-family:var(--font-mono);font-size:12px;letter-spacing:0.04em;text-transform:uppercase;
    box-shadow:0 14px 34px -18px rgba(23,28,23,0.45);
    opacity:0;transform:translateY(-12px);
    transition:opacity 250ms ease,transform 250ms ease;
    white-space:normal;
    max-width:100%;
  `;
  el.textContent = message;
  getContainer().appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-12px)";
    setTimeout(() => el.remove(), 300);
  }, 4000);
}
