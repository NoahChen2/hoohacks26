export default [{
  files:['src/explore/**/*.js','src/entry.js','tests/explore*.test.mjs','scripts/generate-explore-assets.mjs'],
  languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{window:'readonly',document:'readonly',location:'readonly',history:'readonly',URLSearchParams:'readonly',Intl:'readonly',URL:'readonly',FormData:'readonly'}},
  rules:{'no-unused-vars':['error',{argsIgnorePattern:'^_'}],'no-undef':'error','no-constant-condition':'error','no-unreachable':'error','valid-typeof':'error','eqeqeq':['error','always']},
}];
