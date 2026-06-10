/**
 * CognitiveScreen AI — Embeddable Interview Widget
 * ==================================================
 * 
 * USAGE (drop into any HTML page):
 * 
 *   <script src="https://YOUR_COGNITIVESCREEN_DOMAIN/embed.js"></script>
 *   <script>
 *     CognitiveScreen.init({
 *       apiBase: "https://your-backend.com",         // Backend API URL
 *       frontendBase: "https://your-frontend.com",    // Frontend app URL
 *       containerId: "interview-container",           // DOM element ID (optional, creates modal if omitted)
 *       mode: "modal",                                // "modal" | "inline" | "fullscreen"
 *       theme: "dark",                                // "dark" | "light"
 *       onReady: function() { ... },
 *       onInterviewStarted: function(data) { ... },
 *       onInterviewCompleted: function(results) { ... },
 *       onError: function(error) { ... },
 *     });
 *
 *     // Launch interview programmatically:
 *     CognitiveScreen.createAndLaunch({
 *       candidateName: "John Doe",
 *       candidateEmail: "john@example.com",
 *       role: "Full Stack Developer",
 *       jobDescription: "We are looking for...",
 *       resumeText: "John has 5 years of...",
 *       timeMinutes: 30,
 *       rounds: ["psychometrics", "softskills", "resume", "jd"],
 *       webhookUrl: "https://your-app.com/api/results-callback",
 *     });
 *
 *     // Or open with an existing interview link:
 *     CognitiveScreen.launch(interviewLink);
 *
 *     // Close the interview widget:
 *     CognitiveScreen.close();
 *   </script>
 */

(function (global) {
  "use strict";

  var _config = {
    apiBase: "",
    frontendBase: "",
    containerId: null,
    mode: "modal",       // modal | inline | fullscreen
    theme: "dark",
    onReady: null,
    onInterviewStarted: null,
    onInterviewCompleted: null,
    onError: null,
  };

  var _iframe = null;
  var _overlay = null;
  var _initialized = false;

  // ── Styles ──────────────────────────────────────────────────────────────
  var MODAL_STYLES = {
    overlay: [
      "position:fixed", "inset:0", "z-index:99999",
      "background:rgba(0,0,0,0.85)", "backdrop-filter:blur(8px)",
      "display:flex", "align-items:center", "justify-content:center",
      "padding:20px", "opacity:0", "transition:opacity 0.3s ease",
    ].join(";"),
    iframe: [
      "width:100%", "max-width:1400px", "height:90vh",
      "border:1px solid rgba(30,41,59,0.6)", "border-radius:16px",
      "background:#0b0f19", "box-shadow:0 25px 50px rgba(0,0,0,0.5)",
    ].join(";"),
    closeBtn: [
      "position:absolute", "top:16px", "right:16px",
      "width:36px", "height:36px", "border-radius:50%",
      "background:rgba(30,41,59,0.8)", "border:1px solid rgba(71,85,105,0.5)",
      "color:#94a3b8", "font-size:18px", "cursor:pointer",
      "display:flex", "align-items:center", "justify-content:center",
      "transition:background 0.2s", "z-index:10",
    ].join(";"),
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  function createIframe(url) {
    var iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.allow = "camera;microphone;autoplay;fullscreen";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms allow-downloads");
    iframe.style.cssText = "border:none;width:100%;height:100%;";
    return iframe;
  }

  function showModal(url) {
    // Create overlay
    _overlay = document.createElement("div");
    _overlay.style.cssText = MODAL_STYLES.overlay;
    _overlay.setAttribute("id", "cognitivescreen-overlay");

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = MODAL_STYLES.closeBtn;
    closeBtn.innerHTML = "&#x2715;";
    closeBtn.onclick = function () { CognitiveScreen.close(); };
    closeBtn.onmouseenter = function () { this.style.background = "rgba(239,68,68,0.3)"; this.style.color = "#fff"; };
    closeBtn.onmouseleave = function () { this.style.background = "rgba(30,41,59,0.8)"; this.style.color = "#94a3b8"; };
    _overlay.appendChild(closeBtn);

    // Container
    var container = document.createElement("div");
    container.style.cssText = MODAL_STYLES.iframe;
    container.style.position = "relative";
    container.style.overflow = "hidden";

    _iframe = createIframe(url);
    _iframe.style.cssText = "border:none;width:100%;height:100%;border-radius:16px;";
    container.appendChild(_iframe);
    _overlay.appendChild(container);

    document.body.appendChild(_overlay);

    // Fade in
    requestAnimationFrame(function () {
      _overlay.style.opacity = "1";
    });

    // ESC to close
    document.addEventListener("keydown", _escHandler);
  }

  function showInline(url) {
    var container = document.getElementById(_config.containerId);
    if (!container) {
      console.error("[CognitiveScreen] Container element not found:", _config.containerId);
      return;
    }
    _iframe = createIframe(url);
    _iframe.style.cssText = "border:none;width:100%;height:100%;min-height:700px;border-radius:12px;";
    container.innerHTML = "";
    container.appendChild(_iframe);
  }

  function showFullscreen(url) {
    _overlay = document.createElement("div");
    _overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0b0f19;";
    _overlay.setAttribute("id", "cognitivescreen-overlay");

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = MODAL_STYLES.closeBtn;
    closeBtn.innerHTML = "&#x2715;";
    closeBtn.onclick = function () { CognitiveScreen.close(); };
    _overlay.appendChild(closeBtn);

    _iframe = createIframe(url);
    _iframe.style.cssText = "border:none;width:100%;height:100%;";
    _overlay.appendChild(_iframe);

    document.body.appendChild(_overlay);
    document.addEventListener("keydown", _escHandler);
  }

  function _escHandler(e) {
    if (e.key === "Escape") { CognitiveScreen.close(); }
  }

  // ── PostMessage Listener ────────────────────────────────────────────────
  function handleMessage(event) {
    if (!event.data || typeof event.data !== "object") return;
    var type = event.data.type;

    if (type === "cognitivescreen:interview_started") {
      if (_config.onInterviewStarted) {
        _config.onInterviewStarted({
          sessionId: event.data.session_id,
          interviewId: event.data.interview_id,
        });
      }
    }

    if (type === "cognitivescreen:interview_completed") {
      if (_config.onInterviewCompleted) {
        _config.onInterviewCompleted({
          interviewId: event.data.interview_id,
          sessionId: event.data.session_id,
          results: event.data.results,
        });
      }
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────
  var CognitiveScreen = {

    /**
     * Initialize the widget with configuration.
     */
    init: function (options) {
      if (_initialized) return;
      Object.assign(_config, options || {});
      window.addEventListener("message", handleMessage);
      _initialized = true;

      if (_config.onReady) {
        _config.onReady();
      }
      console.log("[CognitiveScreen] Widget initialized", _config.mode, "mode");
    },

    /**
     * Create an interview via the API and immediately launch the widget.
     */
    createAndLaunch: function (params) {
      if (!_config.apiBase) {
        console.error("[CognitiveScreen] apiBase not configured. Call init() first.");
        return Promise.reject("Not initialized");
      }

      var apiBase = _config.apiBase.replace(/\/$/, "");

      return fetch(apiBase + "/api/create-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: params.candidateName,
          candidate_email: params.candidateEmail,
          role: params.role || "General",
          job_description: params.jobDescription || "",
          resume_text: params.resumeText || "",
          time_minutes: params.timeMinutes || 30,
          webhook_url: params.webhookUrl || "",
          rounds: params.rounds || ["psychometrics", "softskills", "resume", "jd"],
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status !== "ok") {
            if (_config.onError) _config.onError(data);
            throw new Error(data.message || "Failed to create interview");
          }

          // Build the interview URL using frontendBase
          var frontendBase = (_config.frontendBase || apiBase).replace(/\/$/, "");
          var interviewUrl = frontendBase + "/#/otp?interview_id=" +
            encodeURIComponent(data.interview_id) +
            "&email=" + encodeURIComponent(params.candidateEmail) +
            "&name=" + encodeURIComponent(params.candidateName) +
            "&role=" + encodeURIComponent(params.role || "General");

          CognitiveScreen.launch(interviewUrl);

          return {
            interviewId: data.interview_id,
            interviewLink: data.interview_link,
            otpCode: data.otp_code,
          };
        })
        .catch(function (err) {
          console.error("[CognitiveScreen] Error:", err);
          if (_config.onError) _config.onError(err);
          throw err;
        });
    },

    /**
     * Launch the interview widget with a given URL.
     */
    launch: function (url) {
      // Add embed marker to URL
      if (url.indexOf("#/otp") !== -1) {
        url = url.replace("#/otp", "#/embed");
      }

      var mode = _config.mode || "modal";
      if (mode === "inline" && _config.containerId) {
        showInline(url);
      } else if (mode === "fullscreen") {
        showFullscreen(url);
      } else {
        showModal(url);
      }
    },

    /**
     * Close the interview widget.
     */
    close: function () {
      document.removeEventListener("keydown", _escHandler);
      if (_overlay && _overlay.parentNode) {
        _overlay.style.opacity = "0";
        setTimeout(function () {
          if (_overlay && _overlay.parentNode) {
            _overlay.parentNode.removeChild(_overlay);
          }
          _overlay = null;
          _iframe = null;
        }, 300);
      } else if (_iframe && _iframe.parentNode) {
        _iframe.parentNode.removeChild(_iframe);
        _iframe = null;
      }
    },

    /**
     * Fetch results for a given interview ID.
     */
    getResults: function (interviewId) {
      var apiBase = _config.apiBase.replace(/\/$/, "");
      return fetch(apiBase + "/api/get-results/" + encodeURIComponent(interviewId))
        .then(function (res) { return res.json(); });
    },
  };

  // Export
  global.CognitiveScreen = CognitiveScreen;

})(typeof window !== "undefined" ? window : this);
