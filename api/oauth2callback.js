import { google } from 'googleapis';

// Simple HTML escape to prevent injection in displayed refresh token
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );

    const code = req.query.code;

    if (!code) {
      return res.status(400).send('<h1>Error</h1><p>Missing authorization code.</p>');
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      // Refresh token absent - user already granted consent previously
      return res.send(`
        <h1>OAuth Successful</h1>
        <p>No new refresh token was issued because you already authorized this app.</p>
        <p>If you need a new refresh token, revoke app access from 
           <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">here</a> and try again.
        </p>
      `);
    }

    // Display refresh token securely for copying
    const safeRefreshToken = escapeHtml(tokens.refresh_token);
    res.send(`
      <h1>Authentication Successful!</h1>
      <p><strong>Copy your refresh token below exactly and add it as <code>REFRESH_TOKEN</code> environment variable in Vercel:</strong></p>
      <textarea readonly style="width: 100%; height: 140px;">${safeRefreshToken}</textarea>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`<h1>OAuth callback error</h1><p>${escapeHtml(err.message)}</p>`);
  }
}
