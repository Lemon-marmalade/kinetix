// Predeclare the globals MediaPipe pose.js populates before it appends helper scripts.
// The packed-assets loader uses window.createMediapipeSolutionsPackedAssets as its Module object,
// not window.Module. If that object is created late, its progress bookkeeping can be undefined
// during XHR callbacks, which intermittently breaks pose startup.
window.createMediapipeSolutionsWasm = window.createMediapipeSolutionsWasm || {};
window.createMediapipeSolutionsPackedAssets = window.createMediapipeSolutionsPackedAssets || {
  dataFileDownloads: {},
  expectedDataFileDownloads: 0,
};

// MediaPipe's CDN loader can emit intermittent non-fatal bootstrap errors even when
// pose results recover and the app works. Suppress only these known messages so
// real application errors still surface normally.
(function suppressBenignMediapipeBootstrapErrors() {
  if (window.__movementCoachMediapipeErrorFilterInstalled) return;
  window.__movementCoachMediapipeErrorFilterInstalled = true;

  var isBenignMediapipeMessage = function (message) {
    if (typeof message !== 'string') return false;
    return (
      message.includes('pose_solution_packed_assets.data') ||
      message.includes("Cannot read properties of undefined (reading 'buffer')")
    );
  };

  window.addEventListener('error', function (event) {
    var message = event && event.message ? String(event.message) : '';
    if (!isBenignMediapipeMessage(message)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    var message =
      typeof reason === 'string'
        ? reason
        : reason && typeof reason.message === 'string'
          ? reason.message
          : '';
    if (!isBenignMediapipeMessage(message)) return;
    event.preventDefault();
  });
})();

(function suppressMediapipeGlLogs() {
  if (window.__movementCoachMediapipeConsoleFilterInstalled) return;
  window.__movementCoachMediapipeConsoleFilterInstalled = true;

  var isBenignMediapipeLog = function (args) {
    var message = Array.prototype.join.call(args, ' ');
    return (
      message.includes('gl_context_webgl.cc') ||
      message.includes('gl_context.cc:359') ||
      message.includes('gl_context.cc:1000')
    );
  };

  var originalInfo = console.info;
  var originalWarn = console.warn;

  console.info = function () {
    if (isBenignMediapipeLog(arguments)) return;
    return originalInfo.apply(this, arguments);
  };

  console.warn = function () {
    if (isBenignMediapipeLog(arguments)) return;
    return originalWarn.apply(this, arguments);
  };
})();
