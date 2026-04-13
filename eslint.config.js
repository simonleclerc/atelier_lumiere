import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Flat config (ESLint 9+). Point d'entrée du linter.
// Ignore les dossiers buildés ou managés par d'autres outils.
export default tseslint.config(
  { ignores: ["dist", "node_modules", "src-tauri/target", "src-tauri/gen"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // react-refresh n'aime pas qu'un fichier exporté à la fois des
      // composants et autre chose — sauf si c'est une constante.
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Composants shadcn/ui : code généré par la CLI, exporte volontairement
    // des variants CVA à côté du composant. On ne touche pas, on silence la règle.
    files: ["src/ui/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
