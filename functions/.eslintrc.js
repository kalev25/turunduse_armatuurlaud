module.exports = {
  root: true, // Lisa see, kui see puudus, aitab vältida konflikte
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2018, // See oli juba olemas
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"], // Oli olemas
    "prefer-arrow-callback": "error", // Oli olemas
    "quotes": ["error", "double", { "allowTemplateLiterals": true }], // Oli olemas, täpsustatud
    // --- Meie lisatud ja muudetud reeglid ---
    "max-len": ["off"], // Lülitab välja rea pikkuse kontrolli
    "indent": ["error", 2, { "SwitchCase": 1 }], // Nõuab 2 tühikut sisse taandamiseks, switch case jaoks 1
    "object-curly-spacing": ["error", "always"], // Kontrollib tühikuid lokkisulgude ümber (nt { a: 1 })
    "arrow-parens": ["error", "always"], // Nõuab alati sulgusid noolfunktsiooni argumentide ümber (nt (arg) => {})
    "comma-dangle": ["error", "always-multiline"], // Nõuab koma rea lõpus mitmerealiste massiivide/objektide puhul
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
