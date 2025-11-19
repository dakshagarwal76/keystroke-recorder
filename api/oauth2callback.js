import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );

    const code = req.query.code;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      // No refresh token returned - this only happens if user already granted consent before
      return res.send(`
        <h1>OAuth Successful</h1>
        <p>No new refresh token was issued because you already authorized this app.</p>
        <p>If you need a new refresh token, revoke app access from <a href="https://myaccount.google.com/permissions">here</a> and try again.</p>
      `);
    }

    // Show the refresh token for you to copy safely
    res.send(`
      <h1>Authentication Successful!</h1>
      <p><strong>Copy your refresh token below exactly and add it as <code>REFRESH_TOKEN</code> environment variable in Vercel:</strong></p>
      <textarea style="width: 100%; height: 140px;">${tokens.refresh_token}</textarea>
    `);
  } catch (err) {
    res.status(500).send(`OAuth callback error: ${err.message}`);
  }
}
