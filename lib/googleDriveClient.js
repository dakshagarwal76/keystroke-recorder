const { google } = require('googleapis');

function getDriveClient() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.OAUTH_REDIRECT_URI;
  const refreshToken = process.env.REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error('REFRESH_TOKEN environment variable not set');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

module.exports = { getDriveClient };
