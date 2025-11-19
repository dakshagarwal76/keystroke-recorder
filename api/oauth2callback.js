// /api/oauth2callback.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );
    const code = req.query.code || req.body.code;

    const { tokens } = await oauth2Client.getToken(code);

    // Save refresh_token so future uploads work!
    // Use a persistent secure way in production (DB or encrypted Vercel KV or Edge Config)
    fs.writeFileSync('/tmp/refresh_token.txt', tokens.refresh_token);
    
    res.send('🔑 Authentication successful! You can now upload files to your Drive.');
  } catch (error) {
    res.status(500).send('OAuth failed: ' + error.message);
  }
}
