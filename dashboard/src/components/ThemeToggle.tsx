"use client";

const STORAGE_KEY = "india-cricket-theme";

export default function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The in-memory toggle still works when browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="theme-icon theme-icon--moon h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="theme-icon theme-icon--sun h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="3.6" />
        <path d="M12 2.4v2M12 19.6v2M4.1 4.1l1.4 1.4m13 13 1.4 1.4M2.4 12h2m15.2 0h2M4.1 19.9l1.4-1.4m13-13 1.4-1.4" />
      </svg>
    </button>
  );
}
