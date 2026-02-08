/**
 * Generate an HTML page that shows a result message and closes the popup window.
 * This is used by the OAuth callback to communicate success/failure back to
 * the parent window (which is polling for popup.closed).
 */
export function closePopupHtml(
	success: boolean,
	message: string,
	pieceName?: string,
): string {
	const color = success ? "#4ade80" : "#f87171";
	const icon = success ? "&#x2714;" : "&#x2718;";
	const title = success ? "Connected!" : "Connection Failed";

	return `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
body {
  font-family: system-ui, -apple-system, sans-serif;
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; margin: 0;
  background: #0d0b14; color: #fff;
}
.card {
  text-align: center; padding: 48px; border-radius: 16px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  max-width: 400px;
}
.icon { font-size: 48px; color: ${color}; margin-bottom: 16px; }
h1 { font-size: 24px; margin: 0 0 8px; color: ${color}; }
p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0 0 24px; }
.close-note { font-size: 12px; color: rgba(255,255,255,0.3); }
</style>
</head>
<body>
<div class="card">
  <div class="icon">${icon}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <div class="close-note">This window will close automatically...</div>
</div>
<script>
setTimeout(function() { window.close(); }, 1500);
</script>
</body>
</html>`;
}
