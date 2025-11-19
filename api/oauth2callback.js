import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );

    const code = req.query.code;

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Log tokens for debug
    console.log('OAuth tokens:', tokens);

    if (!tokens.refresh_token) {
      // No refresh token means it was previously authorized
      res.setHeader('Content-Type', 'text/html');
      res.end(`
        <h1>No refresh token received</h1>
        <p>Either you already authorized this app before or something is wrong.</p>
        <p>Please revoke access to the app in your Google account and try again.</p>
      `);
      return;
    }

    // Show refresh token so you can copy it directly
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <h1>🔑 Authentication Successful!</h1>
      <p>Copy your refresh token below and add it as <code>REFRESH_TOKEN</code> in your environment variables:</p>
      <textarea style="width:100%;height:200px;">${tokens.refresh_token}</textarea>
      <p>Then redeploy your application.</p>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`OAuth callback error: ${error.message}`);
  }
}
