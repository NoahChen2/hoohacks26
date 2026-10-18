export default [{
  files:['src/explore/**/*.js','src/studio/**/*.js','src/entry.js','server/**/*.js','vite.config.js','tests/*.test.mjs','scripts/generate-explore-assets.mjs'],
  languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{structuredClone:'readonly',process:'readonly',Buffer:'readonly',console:'readonly',fetch:'readonly',AbortController:'readonly',FileReader:'readonly',Image:'readonly',setTimeout:'readonly',window:'readonly',document:'readonly',location:'readonly',history:'readonly',URLSearchParams:'readonly',Intl:'readonly',URL:'readonly',FormData:'readonly'}},
  rules:{'no-unused-vars':['error',{argsIgnorePattern:'^_'}],'no-undef':'error','no-constant-condition':'error','no-unreachable':'error','valid-typeof':'error','eqeqeq':['error','always']},
}];
