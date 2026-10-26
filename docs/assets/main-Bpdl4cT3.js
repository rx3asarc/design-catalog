var e=`import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// A deploy replaces content-hashed chunks; a page cached from the previous deploy asks for names
// that no longer exist. That is cache skew, not a broken app, so reload once onto the current html.
addEventListener("vite:preloadError", () => {
  const k = "designCatalogReloaded";
  if (!sessionStorage.getItem(k)) {
    sessionStorage.setItem(k, "1");
    location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
`;export{e as default};