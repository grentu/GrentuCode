import { run } from "./ui/App";

if (!process.stdin.isTTY) {
  console.error("Grentu Code requires an interactive terminal (TTY).");
  console.error("Run `grentu` directly in your terminal, not through a pipe.");
  process.exit(1);
}

run();
