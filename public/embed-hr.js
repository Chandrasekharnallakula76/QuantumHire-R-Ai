/**
 * CognitiveScreen AI — HR Dashboard Embed Widget
 * 
 * Embeds the HR recruiter panel for sending interview invitations.
 * 
 * Usage:
 * 
 *   <div id="hr-panel"></div>
 *   <script src="https://YOUR_FRONTEND_URL/embed-hr.js"
 *     data-container="#hr-panel"
 *     data-height="700px">
 *   </script>
 * 
 * Or programmatic:
 * 
 *   <script src="https://YOUR_FRONTEND_URL/embed-hr.js"></script>
 *   <script>
 *     CognitiveScreenHR.init({
 *       container: '#hr-panel',
 *       width: '100%',
 *       height: '700px',
 *       onInviteSent: function(data) {
 *         console.log('Interview sent to:', data.email);
 *       }
 *     });
 *   </script>
 */

(function () {
  'use strict';

  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var scriptSrc = currentScript.src || '';
  var BASE_URL = scriptSrc.replace(/\/embed-hr\.js.*$/, '') || window.location.origin;

  var CognitiveScreenHR = {
    _iframe: null,

    init: function (opts) {
      opts = opts || {};

      var container;
      if (typeof opts.container === 'string') {
        container = document.querySelector(opts.container);
      } else if (opts.container instanceof HTMLElement) {
        container = opts.container;
      }

      if (!container) {
        console.error('[CognitiveScreenHR] Container not found:', opts.container || '(none)');
        return;
      }

      var iframeSrc = BASE_URL + '/#/hr-embed';

      var iframe = document.createElement('iframe');
      iframe.src = iframeSrc;
      iframe.style.width = opts.width || '100%';
      iframe.style.height = opts.height || '700px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = opts.borderRadius || '12px';
      iframe.style.overflow = 'hidden';
      iframe.style.backgroundColor = '#060a14';

      // Required permissions for camera, microphone, and other features
      // Using the Permissions Policy syntax with wildcard for same-origin
      iframe.allow = 'camera *; microphone *; display-capture *; clipboard-write *; autoplay *; fullscreen *';
      iframe.setAttribute('allowfullscreen', 'true');

      // Removed sandbox attribute to allow full camera/microphone access
      // Since this is same-origin content, sandbox restrictions would block media devices

      container.innerHTML = '';
      container.appendChild(iframe);

      this._iframe = iframe;

      window.addEventListener('message', function (event) {
        if (event.origin !== new URL(BASE_URL).origin) return;
        var data = event.data;
        if (data && data.type === 'cognitivescreen:invite_sent') {
          if (typeof opts.onInviteSent === 'function') {
            opts.onInviteSent(data.details);
          }
        }
        if (data && data.type === 'cognitivescreen:error') {
          if (typeof opts.onError === 'function') {
            opts.onError(data.error);
          } else {
            console.error('[CognitiveScreenHR] Error from iframe:', data.error);
          }
        }
      });

      return iframe;
    },

    destroy: function () {
      if (this._iframe && this._iframe.parentNode) {
        this._iframe.parentNode.removeChild(this._iframe);
        this._iframe = null;
      }
    }
  };

  // Auto-init from data attributes
  var autoContainer = currentScript.getAttribute('data-container');
  if (autoContainer) {
    var autoInit = function () {
      CognitiveScreenHR.init({
        container: autoContainer,
        width: currentScript.getAttribute('data-width') || '100%',
        height: currentScript.getAttribute('data-height') || '700px',
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }

  window.CognitiveScreenHR = CognitiveScreenHR;
})();
