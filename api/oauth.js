import { google } from 'googleapis';

export default function handler(req, res) {
  try {
    // Create OAuth2 client with client ID, secret, and redirect URI from environment variables
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );

    // Generate the Google OAuth2 authorization URL
    // 'access_type: offline' ensures refresh token is received
    // 'prompt: consent' forces consent screen to reappear for refresh token grant
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    // Redirect the user agent to the Google OAuth2 consent page
    res.redirect(url);
  } catch (error) {
    // Handle unexpected errors gracefully
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
}
