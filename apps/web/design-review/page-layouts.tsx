import { createRoot } from "react-dom/client";
import { SubpageComparison, SubpageExample } from "./subpage-comparison";
import "./page-layouts.css";

createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).has("subpage") ? <SubpageExample /> : <SubpageComparison />);
