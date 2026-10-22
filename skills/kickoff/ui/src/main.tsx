import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useRoute } from "./lib/hooks";
import { Project } from "./pages/project/Project";
import { ProjectList } from "./pages/ProjectList";
import "./styles.css";
import { OverlayProvider } from "./ui";

function App() {
  const { slug, tab } = useRoute();
  return slug ? <Project key={slug} slug={slug} tab={tab} /> : <ProjectList />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayProvider>
      <App />
    </OverlayProvider>
  </StrictMode>,
);
