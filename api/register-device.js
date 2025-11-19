const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.OAUTH_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

// Use oauth2Client for Drive API
const drive = google.drive({ version: 'v3', auth: oauth2Client });