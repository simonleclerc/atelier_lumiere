import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ui/App";
import { container } from "./app/container";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App greetUser={container.greetUser} />
  </React.StrictMode>,
);
