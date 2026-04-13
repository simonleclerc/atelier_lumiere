import { useState } from "react";
import reactLogo from "./assets/react.svg";
import type { GreetUserUseCase } from "@/domain/usecases/GreetUser";
import { Button } from "@/ui/components/ui/button";

interface AppProps {
  greetUser: GreetUserUseCase;
}

function App({ greetUser }: AppProps) {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function handleGreet() {
    setGreetMsg(await greetUser.execute(name));
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Welcome to Tauri + React</h1>

      <div className="flex justify-center gap-4">
        <a href="https://vite.dev" target="_blank">
          <img
            src="/vite.svg"
            className="h-24 p-4 transition hover:drop-shadow-[0_0_2em_#747bff]"
            alt="Vite logo"
          />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img
            src="/tauri.svg"
            className="h-24 p-4 transition hover:drop-shadow-[0_0_2em_#24c8db]"
            alt="Tauri logo"
          />
        </a>
        <a href="https://react.dev" target="_blank">
          <img
            src={reactLogo}
            className="h-24 p-4 transition hover:drop-shadow-[0_0_2em_#61dafb]"
            alt="React logo"
          />
        </a>
      </div>
      <p className="text-muted-foreground">
        Click on the Tauri, Vite, and React logos to learn more.
      </p>

      <form
        className="flex justify-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleGreet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit">Greet</Button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
