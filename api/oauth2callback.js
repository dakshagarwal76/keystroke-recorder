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

    console.log('OAuth tokens:', tokens);

    if (!tokens.refresh_token) {
      return res.status(400).send(`
        <h1>No refresh token received</h1>
        <p>Revoke app permissions in your Google Account and try again.</p>
      `);
    }

    return res.send(`
      <h1>🔑 Authentication Successful!</h1>
      <p>Copy this refresh token:</p>
      <textarea style="width:100%; height: 150px;">${tokens.refresh_token}</textarea>
      <p>Add it as <code>REFRESH_TOKEN</code> in your Vercel environment variables and redeploy.</p>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).send(`OAuth callback error: ${error.message}`);
  }
}
