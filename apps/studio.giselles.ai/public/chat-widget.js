(function () {
	"use strict";

	// Find the script tag to read configuration
	var scripts = document.querySelectorAll("script[data-workspace-id]");
	var script = scripts[scripts.length - 1];
	if (!script) return;

	var workspaceId = script.getAttribute("data-workspace-id");
	if (!workspaceId) return;

	var baseUrl = script.src
		? new URL(script.src).origin
		: window.location.origin;
	var primaryColor = script.getAttribute("data-primary-color") || "#6366f1";
	var position = script.getAttribute("data-position") || "bottom-right";

	// Create styles
	var style = document.createElement("style");
	style.textContent =
		"#vibexe-chat-widget-container{position:fixed;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
		"#vibexe-chat-widget-container.bottom-right{bottom:20px;right:20px}" +
		"#vibexe-chat-widget-container.bottom-left{bottom:20px;left:20px}" +
		"#vibexe-chat-toggle{width:56px;height:56px;border-radius:28px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform 0.2s}" +
		"#vibexe-chat-toggle:hover{transform:scale(1.05)}" +
		"#vibexe-chat-iframe-wrapper{display:none;width:400px;height:600px;max-width:calc(100vw - 40px);max-height:calc(100vh - 100px);border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4);margin-bottom:12px}" +
		"#vibexe-chat-iframe-wrapper.open{display:block}" +
		"#vibexe-chat-iframe{width:100%;height:100%;border:none;border-radius:16px}" +
		"@media(max-width:480px){#vibexe-chat-iframe-wrapper{width:calc(100vw - 20px);height:calc(100vh - 80px);position:fixed;bottom:10px;right:10px;left:10px;margin-bottom:0}}";
	document.head.appendChild(style);

	// Create container
	var container = document.createElement("div");
	container.id = "vibexe-chat-widget-container";
	container.className = position;

	// Create iframe wrapper
	var iframeWrapper = document.createElement("div");
	iframeWrapper.id = "vibexe-chat-iframe-wrapper";

	var iframe = document.createElement("iframe");
	iframe.id = "vibexe-chat-iframe";
	iframe.src = baseUrl + "/chat/" + workspaceId;
	iframe.title = "Chat Widget";
	iframe.setAttribute("loading", "lazy");
	iframeWrapper.appendChild(iframe);

	// Create toggle button
	var toggle = document.createElement("button");
	toggle.id = "vibexe-chat-toggle";
	toggle.style.backgroundColor = primaryColor;
	toggle.innerHTML =
		'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0034 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.9C9.87812 3.30493 11.1801 2.99656 12.5 3H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	toggle.setAttribute("aria-label", "Open chat");

	var isOpen = false;
	toggle.addEventListener("click", function () {
		isOpen = !isOpen;
		iframeWrapper.className = isOpen
			? "open"
			: "";
		toggle.innerHTML = isOpen
			? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
			: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0034 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.9C9.87812 3.30493 11.1801 2.99656 12.5 3H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		toggle.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
	});

	container.appendChild(iframeWrapper);
	container.appendChild(toggle);
	document.body.appendChild(container);
})();
