// Entry point: start building the body in its worker (boot.js) before the app
// bundle has downloaded and parsed, then load the app.
import './boot.js';
import('./app.js');
